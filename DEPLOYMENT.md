# Deployment Runbook

Operational runbook for running InsolvencyVDR in production. Reflects exactly what was set up and
verified on the live VPS (Ubuntu 24.04, Hostinger) at `vdr.variedreach.com` — not a generic guide.

See [STAGING.md](STAGING.md) for the staging environment at `staging.vdr.variedreach.com` and the
branch workflow changes now follow (`development` → staging review → `main` → production) before
landing here.

## 1. Prerequisites

- Ubuntu 24.04 VPS with Docker, Docker Compose v2, and Git installed.
- A domain's A record pointed at the VPS's public IP (required before SSL setup — DNS must have
  actually propagated, not just been configured. Check with `dig +short <domain>` from outside the
  VPS and confirm it resolves to the VPS's IP).
- Root or sudo SSH access.

## 2. First-time setup

```bash
git clone https://github.com/merohit431-rgb/variedreach-vdr.git /opt/variedreach-vdr
cd /opt/variedreach-vdr
```

Create `apps/backend/.env` and `apps/frontend/.env.local` (see `.env.example` in each app for the
full variable list). Production-critical values:

- `apps/backend/.env`:
  - `DATABASE_URL` — must point at the `postgres` service name (Docker network), not `localhost`.
  - `REDIS_URL` — same, points at `redis` service name.
  - `JWT_ACCESS_SECRET`, `COOKIE_SECRET` — generate real random secrets, e.g.
    `openssl rand -base64 48`.
  - `FRONTEND_URL` — the real public HTTPS URL (e.g. `https://vdr.variedreach.com`). Drives both
    the CORS allow-list in `main.ts` and the links generated in invite/password-reset emails. Get
    this wrong and login breaks with a CORS error, and invite emails contain dead links.
  - `MAIL_HOST`/`MAIL_PORT`/etc. — real SMTP credentials. The live VPS uses Resend's SMTP relay:
    `MAIL_HOST=smtp.resend.com`, `MAIL_PORT=465`, `MAIL_SECURE=true`, `MAIL_USER=resend`,
    `MAIL_PASSWORD=<resend API key>`. `MAIL_FROM_ADDRESS` must be on a domain verified in Resend's
    dashboard (resend.com/domains) — sending from an unverified domain fails outright, even with a
    valid API key. On this deployment the verified domain is the `vdr.variedreach.com` subdomain
    specifically, not the bare `variedreach.com` apex — verify which one before assuming either.
    MailHog remains available (`docker compose --profile dev up -d mailhog`) for local/dev testing
    without spending real sends, but production traffic goes through Resend.
- `apps/frontend/.env.local`:
  - `NEXT_PUBLIC_API_URL` — the same public HTTPS URL as `FRONTEND_URL` above. This is baked into
    the client bundle at **build time**, not read at runtime — changing it requires rebuilding the
    frontend image, not just restarting the container.
  - `NEXT_PUBLIC_APP_URL` — same public HTTPS URL.

## 3. Build and start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

This builds backend, frontend, and nginx images and starts postgres/redis/backend/frontend. Nginx
will fail to start on a completely fresh deploy (no certificate yet) — that's expected; the SSL
bootstrap step below handles it. Do not add `docker-compose.prod.yml`'s services manually before
that script runs.

### First-time database setup

```bash
cd apps/backend
docker compose -f ../../docker-compose.yml -f ../../docker-compose.prod.yml exec backend sh -c \
  "cd apps/backend && npx prisma db push"
docker compose -f ../../docker-compose.yml -f ../../docker-compose.prod.yml exec backend sh -c \
  "cd apps/backend && npx prisma db seed"
```

(The `cd apps/backend` inside the exec is required — the container's WORKDIR is `/app`, but the
Prisma schema lives at `apps/backend/prisma/`. Use `db push`, not `migrate deploy` — there is no
`prisma/migrations` directory in this repo at all, so `migrate deploy` runs as a silent no-op and
leaves the database schema-less. The schema has always been synced with `db push`.)

## 4. SSL (Let's Encrypt)

Only after DNS has propagated and the stack above is built:

```bash
./infrastructure/scripts/init-letsencrypt.sh <domain> <email>
```

This is idempotent — re-running it when a real Let's Encrypt cert already exists for the domain is
a no-op. It handles the dummy-cert chicken-and-egg problem (Nginx needs *some* cert to start before
it can serve the ACME HTTP-01 challenge) automatically.

After this, **only Nginx should have published ports** (80/443). Verify with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Ports}}"
```

Backend/frontend/postgres/redis should show no host port mapping at all — they're reached only via
Nginx's internal `proxy_pass` to their Docker-network hostnames.

## 5. Firewall

UFW, restricted to exactly what's needed once Nginx is the sole public entry point:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP (redirects to HTTPS)"
ufw allow 443/tcp comment "HTTPS"
ufw enable
```

Always add the allow rules *before* `ufw enable`, and always allow the actual SSH port in use
before enabling — getting this order wrong locks you out of the VPS.

## 6. Cron jobs

Installed via `crontab -e` (or `crontab -l` to inspect current state):

```cron
17 3,15 * * * /opt/variedreach-vdr/infrastructure/scripts/renew-cert.sh >> /var/log/insolvency-vdr/certbot-renew.log 2>&1
0 2 * * * /opt/variedreach-vdr/infrastructure/scripts/backup-db.sh >> /var/log/insolvency-vdr/backup.log 2>&1
0 */6 * * * /opt/variedreach-vdr/infrastructure/scripts/check-disk-space.sh >> /var/log/insolvency-vdr/disk-space.log 2>&1
0 * * * * /opt/variedreach-vdr/infrastructure/scripts/cleanup-upload-temp.sh vdr_backend >> /var/log/insolvency-vdr/upload-temp-cleanup.log 2>&1
0 3 * * 0 /opt/variedreach-vdr/infrastructure/scripts/docker-maintenance.sh
*/5 * * * * /opt/variedreach-vdr/infrastructure/scripts/monitor-backend-memory.sh vdr_backend
```

`mkdir -p /var/log/insolvency-vdr` first if it doesn't already exist.

`docker-maintenance.sh` writes its own log internally (to `/var/log/vdr/docker-maintenance.log`, which it
creates itself), so its crontab line has no `>>` redirect of its own.

- **Certificate renewal** (twice daily — Let's Encrypt's own recommendation, so a transient failure
  doesn't risk the cert expiring before the next attempt): `renew-cert.sh` runs `certbot renew`
  (no-op unless within 30 days of expiry) then reloads Nginx unconditionally — a reload is cheap
  and harmless even when nothing renewed.
- **Backups** (daily at 2am): `backup-db.sh` dumps Postgres and archives the `backend_uploads`
  volume separately — the uploaded files live on disk, not in Postgres, so a DB-only backup loses
  every actual document. 14-day retention by default (`RETENTION_DAYS` env override).
- **Disk space** (every 6 hours): `check-disk-space.sh` exits non-zero above 85% usage
  (`DISK_THRESHOLD_PERCENT` override). Worth watching specifically on this app — there's no
  S3/object-storage migration in V1.0, so the VPS's local disk is the only place uploaded documents
  live.
- **Upload temp cleanup** (hourly): `cleanup-upload-temp.sh` removes files from the upload temp
  directory older than 2 hours (`RETENTION_MINUTES` override). Uploads stream to disk before being
  moved into permanent storage; a cancelled or dropped upload leaves a partial file there with no
  code path that cleans it up on its own. With uploads now up to 2GB, this matters more than it
  used to.
- **Docker build cache maintenance** (weekly, Sunday 3am): `docker-maintenance.sh` runs
  `docker builder prune -af --filter "until=168h"`, removing build cache older than 7 days. Scoped
  to build cache only — by definition this command cannot touch running containers, in-use images,
  named volumes, or any data. Repeated `--no-cache` rebuilds during development can otherwise let
  this grow to tens of GB unnoticed (one session took it to 62.97GB before a manual prune). Logs
  every run to `/var/log/vdr/docker-maintenance.log`, flags the run as notable if it reclaims more
  than 5GB (`NOTABLE_RECLAIM_GB` override), and logs and exits non-zero on failure.
- **Backend memory monitoring** (every 5 minutes): `monitor-backend-memory.sh` appends the backend
  container's current memory usage and percent-of-limit to `/var/log/vdr/backend-memory.log`. Added
  after the 512MB limit OOM-killed the backend process — once a limit changes, this is how to tell
  whether the new ceiling has real headroom or usage is still climbing toward it, without needing to
  watch `docker stats` live. To find the peak over any window:
  `awk '{print $NF}' /var/log/vdr/backend-memory.log | sort -V | tail -1` (or just `grep` the log
  for the highest `MemPerc` value).

Check logs at `/var/log/insolvency-vdr/*.log` to confirm these are actually running, not just
installed.

## 7. Restoring from backup

**Destructive — replaces all current data.**

```bash
./infrastructure/scripts/restore-db.sh /var/backups/insolvency-vdr/db-TIMESTAMP.sql.gz /var/backups/insolvency-vdr/uploads-TIMESTAMP.tar.gz
```

Requires typing `restore` to confirm. Stops the backend during the restore so nothing writes
mid-restore, drops and recreates the database from the dump, replaces the uploads volume contents,
then restarts the backend.

## 8. Production change management

**Production is never modified directly.** Every change — code, config, infrastructure — follows
this sequence:

1. **Investigate the issue completely.** Reproduce it, read the actual logs/error, don't guess.
2. **Root cause analysis.** Identify *why*, not just *what broke* — a fix aimed at the symptom
   instead of the cause tends to resurface later in a different shape.
3. **Implement the fix on `development`.**
4. **Deploy to staging** (`staging.vdr.variedreach.com`) and verify there:
   - Login
   - Uploads
   - Downloads
   - Watermarking
   - Office conversion
   - Email sending
   - Background jobs
   - Database migrations
   - Health checks
   - Container health
   - Memory usage
5. **Stress test on staging** where the change plausibly affects load behavior (large files,
   concurrent uploads, etc.) — not required for every change, but don't skip it for anything
   touching the upload path, memory limits, or request handling.
6. **Production stays untouched for the entire duration of steps 1–5.**
7. **Write a deployment plan and a rollback plan** (see template below) and present both before
   asking for approval.
8. **Wait for explicit approval.** Not "looks fine" in passing — an actual go-ahead for *this*
   change.
9. **Only after approval**, deploy to production.
10. **Take a fresh production backup immediately before deploying** — `backup-db.sh` run by hand,
    not waiting for the next 2am cron.
11. **Verify production after deployment** using the same checklist as step 4.
12. **Monitor for at least 30 minutes post-deploy** and report anything abnormal — error rates,
    memory, restart counts — even if nothing looks obviously wrong.

**The one exception: an active production outage.** If `vdr.variedreach.com` is genuinely down or a
core function (login, uploads) is broken *right now* for real users, an emergency hotfix skips
straight to a direct, careful production fix — investigate and root-cause first, even under
pressure, but don't wait for a staging round-trip while users can't log in. The June 30 backend OOM
incident is the reference case: production was actually broken, so it got a direct, verified
hotfix. A latent bug found *during* unrelated verification (no active user impact, nothing
currently failing for anyone) does not qualify, even if it's a real bug — it goes through the full
process like everything else.

### Deployment plan / rollback plan template

Every production deployment (steps 7–8 above) should come with both of these, not just a "ready to
ship" message:

**Deployment plan:**
- What's changing and why (root cause, one paragraph)
- Exact commands that will run on the VPS, in order
- Which containers get rebuilt vs. just recreated vs. untouched
- Whether a schema change is involved, and the exact `prisma db push` (or migration) command
- Expected brief-downtime windows, if any, and which containers

**Rollback plan:**
- The exact previous image tag/commit to redeploy if something goes wrong (see image tagging in
  §12 below — without a tagged previous image, "rollback" means rebuilding from an older commit,
  which is slower and itself a deploy)
- Whether the change includes a schema migration that also needs reverting, and how (since this
  project uses `prisma db push` rather than versioned migrations, a schema rollback today means a
  manually-written reverse `db push`, not an automated `migrate down` — call this out explicitly
  per deployment rather than assuming it's handled)
- The specific health checks that confirm a rollback actually worked

## 9. Deploying a new version

```bash
cd /opt/variedreach-vdr
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Compose only recreates containers whose image or config actually changed — this is safe to run
even when only one app changed. If the Prisma schema changed:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend sh -c \
  "cd apps/backend && npx prisma db push"
```

As of this version, all changes land on production through the staging promotion flow — see
[STAGING.md](STAGING.md) — rather than `git pull`+rebuild directly against `main` on the VPS. See
§8 above for the full change-management process this command is the last step of, and §12 below for
how this causes brief downtime today and what it would take not to.

## 10. Known gaps (as of this runbook)

- **No object storage** — uploaded files live on the VPS's local disk (`backend_uploads` volume).
  Fine for V1.0 scale; revisit if storage needs outgrow a single VPS's disk.
- **Multi-tenancy / Super Admin / per-data-room storage quotas** are explicitly deferred to a V1.1
  planning phase — see project notes. Not part of this deployment's scope.

## 11. Gotchas worth remembering

- **Compose merge tags**: `ports:`/`volumes:` lists merge *additively* across `-f` files by
  default — an empty override does not clear a base file's entries. Use the `!override` YAML tag to
  actually replace a list (including with an empty one). Do **not** use `!reset` for a non-empty
  replacement value — it silently drops the key entirely instead of applying the new value. Verify
  any merge-key fix with `docker compose ... config --format json`, not just by checking the
  resulting behavior looks right (an empty result can be "correct" for the wrong reason).
- **`NEXT_PUBLIC_*` env vars are build-time, not runtime** — changing them requires rebuilding the
  frontend image, not just restarting the container.
- **Prisma on Alpine needs both** an explicit `binaryTargets` entry for `linux-musl-openssl-3.0.x`
  *and* the `openssl` CLI package installed (`apk add openssl`) — Prisma's engine-selection shells
  out to `openssl` to detect the version, and silently falls back to the wrong engine if the CLI
  binary itself isn't present, even when the correct engine is already bundled.
- **A container recreating gets a new internal IP, and Nginx used to cache the old one forever** —
  fixed for good in the shared Nginx config (see §12), but worth understanding if a *different*
  proxy or service discovery mechanism is ever added: anything that resolves a container hostname
  once and holds onto it needs an explicit re-resolution story, or a restart silently breaks
  connectivity until someone notices.

## 12. Zero-downtime deployment — current state and what it would take

Today's deploy (`docker compose ... up -d --build`, §9) recreates a container: the old one stops,
the new one starts, and there's a real gap in between where that service can't serve traffic. For
backend/frontend this is usually a few seconds; for Nginx it briefly affects all three apps sharing
it (vdr, staging, evoting — see STAGING.md). This section is an honest assessment of each piece of
a zero-downtime story: what's already true, what's a reasonably small fix, and what would require
real architectural investment.

**Docker deployment strategy.** No rolling or blue-green deploy exists — `up -d --build` is a
stop-then-start of a single instance. Genuine rolling deployment (old instance keeps serving while
the new one comes up, then traffic shifts) needs either a real orchestrator (Swarm `docker stack
deploy` with `update_config`, or Kubernetes) or a hand-rolled blue-green script on top of plain
Compose (start a second backend instance under a different name, wait for it to pass health checks,
point Nginx at it, drain and remove the old one). The orchestrator path is the bigger lift but the
more correct long-term answer; the scripted path is achievable without changing the deployment
platform but is custom code that has to be maintained and tested like any other part of the system.
**This is the one item on this list that's a real architecture decision, not a config tweak — don't
start it without agreeing which path first.**

**Container restart sequence.** Already reasonably good: `depends_on: condition: service_healthy`
(used throughout `docker-compose.prod.yml`) means Nginx won't start routing to backend/frontend
until their health checks pass. The gap isn't startup ordering, it's that there's no "drain the old
instance before stopping it" step — Compose stops the old container and starts the new one, it
doesn't keep both running during a handoff. Closing that gap is really the same work as the rolling
deployment item above, not a separate fix.

**Nginx reload strategy.** Partially fixed today (§12 of the Nginx config itself — dynamic upstream
resolution means a backend/frontend restart no longer needs a manual Nginx restart to recover, see
the OOM incident writeup). What's still true: a change to `nginx.conf` itself requires rebuilding
the Nginx image (the config is `COPY`'d in at build time) and recreating the container, which is a
brief moment of downtime for all three apps on this VPS. Nginx natively supports `nginx -s reload`
for a zero-downtime config reload (binary upgrade, no dropped connections) — but that only works if
the new config is already on disk inside the running container, which means switching from baking
`nginx.conf` into the image to mounting it as a volume (`./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro`).
That's a small, low-risk change that would make Nginx config changes specifically zero-downtime —
worth doing on its own regardless of the bigger rolling-deployment question.

**Database migration strategy.** This project uses `prisma db push` exclusively — confirmed (again)
there is no `prisma/migrations` directory anywhere in the repo. That's a deliberate, established
choice for this project (see CLAUDE.md / earlier project notes), but it means: no migration history,
no `prisma migrate deploy` review step, and no automated rollback for a schema change — reverting
one today means hand-writing the reverse `db push`. Moving to versioned migrations
(`prisma migrate dev` locally, `prisma migrate deploy` in CI/deploy) would give real rollback
capability and a reviewable history of every schema change, at the cost of changing a workflow
that's been used consistently across this entire project so far. **Flagging this as a real option,
not recommending it unilaterally** — it's a bigger process change than anything else on this list.

**Health-check-based deployment.** Compose health checks exist (`backend`, `frontend`, `postgres`,
`redis`, `gotenberg` all have one) and gate container *startup* ordering. They don't currently gate
whether a *deployment* is considered successful — that's still a human running curl checks
afterward. A deploy script that polls the new container's health check after recreation and
automatically stops/reverts if it doesn't pass within N seconds is a real, achievable improvement
that doesn't require the bigger rolling-deployment work first.

**Graceful shutdown — a concrete gap, not just a theoretical one.** Checked `main.ts`: the backend
never calls `app.enableShutdownHooks()`, and there's no custom `SIGTERM` handler. Node's default
behavior on `SIGTERM` with nothing listening for it is to terminate — in-flight requests at the
moment a container is asked to stop (a deploy, a recreate, the daily restart that fixed July's
nginx/OOM incident) get cut off rather than finishing. Separately, the frontend's
`CMD ["npm", "run", "start", ...]` runs Next.js as a child process *of* npm rather than directly —
npm is a known-unreliable signal forwarder, so `SIGTERM` sent to the frontend container may not
reach the actual Next.js server process at all, meaning Docker falls through to a hard `SIGKILL`
after the grace period instead of a clean exit. Both are fixable without architectural change:
add `app.enableShutdownHooks()` (plus an explicit HTTP-server-close-and-drain handler for true
in-flight-request safety) to the backend, and change the frontend's `CMD` to invoke Next.js directly
(`node node_modules/next/dist/bin/next start` or equivalent) instead of through `npm run`.

**Rolling deployment.** Not feasible today without the Docker deployment strategy decision above —
same root gap, same fix.

**Automatic rollback on failure.** Doesn't exist, and there's a prerequisite gap underneath it:
images are never tagged with a version — every build overwrites the same `:latest` tag (confirmed:
no `image:` field with a version anywhere in `docker-compose.prod.yml`). That means there is
currently no way to "roll back to the previous image" — a rollback today means rebuilding from an
older git commit, which is itself a deploy, not a fast revert. **This is the highest-value, lowest-risk
fix on this entire list**: tag images with the deploying git commit SHA at build time (e.g.
`variedreach-vdr-backend:$(git rev-parse --short HEAD)` alongside `:latest`), keep the last several
tags around, and a rollback becomes "redeploy the previous tag" — seconds, not a rebuild. This
directly serves the rollback-plan requirement in §8 as well, independent of anything else on this
list.

### Summary: what's worth doing, roughly in order

1. **Tag images with the git commit SHA on every build, keep recent tags.** Small, safe, and it's
   the actual prerequisite for any real rollback plan — including the manual ones §8 already
   requires per deployment.
2. **Mount `nginx.conf` as a volume instead of baking it into the image**, so config changes use
   `nginx -s reload` instead of a rebuild+recreate. Small, safe, makes the most frequently-touched
   piece of shared infrastructure (this Nginx serves three separate apps) reloadable without
   affecting any of them.
3. **Fix graceful shutdown**: `enableShutdownHooks()` + drain logic on the backend, fix the
   frontend's `CMD` to bypass npm's signal-forwarding issue. Small, safe, directly reduces the
   "few seconds of downtime" window on every single deploy regardless of anything else here.
4. **A deploy script that checks health post-recreate and reports/reverts on failure.** Moderate
   effort, meaningfully reduces how long a bad deploy stays live before a human notices.
5. **Real rolling/blue-green deployment.** The big one — needs an explicit decision on orchestrator
   vs. hand-rolled scripting before any implementation starts, per the note above.
6. **Versioned Prisma migrations instead of `db push`.** Independent of the rest of this list,
   worth deciding on its own terms rather than bundling into a "zero-downtime" initiative.

None of this has been implemented — this is the investigation and recommendation §8 asks for before
any production-affecting change. Items 1–4 are small enough to do directly on `development` →
staging → approval, same as any other change. Items 5 and 6 are real architecture decisions that
deserve their own discussion before anyone writes code.
