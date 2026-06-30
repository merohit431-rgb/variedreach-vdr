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

## 8. Deploying a new version

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
[STAGING.md](STAGING.md) — rather than `git pull`+rebuild directly against `main` on the VPS.

## 9. Known gaps (as of this runbook)

- **No object storage** — uploaded files live on the VPS's local disk (`backend_uploads` volume).
  Fine for V1.0 scale; revisit if storage needs outgrow a single VPS's disk.
- **Multi-tenancy / Super Admin / per-data-room storage quotas** are explicitly deferred to a V1.1
  planning phase — see project notes. Not part of this deployment's scope.

## 10. Gotchas worth remembering

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
