# Staging Environment & Branch Workflow

Companion to [DEPLOYMENT.md](DEPLOYMENT.md). Describes the staging environment at
`staging.vdr.variedreach.com` and the branch workflow every change (V1.1 onward) follows before it
reaches production at `vdr.variedreach.com`.

## 1. Branch workflow

```
development  ──develop & commit──>  (push)
     │
     ▼
staging.vdr.variedreach.com  ──Rohit reviews & approves──>
     │
     ▼
main  ──deploy──>  vdr.variedreach.com
```

- **`development`** — where all new feature work happens. Push here; staging is updated from this
  branch (see §4).
- **`main`** — the production branch. Only receives code after it's been reviewed and approved on
  staging. `vdr.variedreach.com` always tracks `main`.
- No more direct pushes from a feature branch straight to `main` — that was the V1.0-deployment-day
  pattern and is retired as of this workflow.

**Exception:** changes to shared edge infrastructure that staging itself depends on (e.g. the
Nginx config that proxies both domains — see §2) go straight to `main`, because there is no way to
"stage" the thing that makes staging reachable in the first place. Application code always follows
the full flow above.

## 2. Architecture: what's shared, what's isolated

One VPS runs both environments side by side. **Only the edge (Nginx + DNS) is shared** — every
application-level resource is fully separate.

| Layer | Production | Staging |
|---|---|---|
| Git checkout | `/opt/variedreach-vdr` (branch `main`) | `/opt/variedreach-vdr-staging` (branch `development`) |
| Compose project | `variedreach-vdr` | `variedreach-vdr-staging` |
| Compose files | `docker-compose.yml` + `docker-compose.prod.yml` | `docker-compose.yml` + `docker-compose.staging.yml` |
| Containers | `vdr_postgres`, `vdr_redis`, `vdr_backend`, `vdr_frontend`, `vdr_nginx`, `vdr_gotenberg` | `vdr_staging_postgres`, `vdr_staging_redis`, `vdr_staging_backend`, `vdr_staging_frontend`, `vdr_staging_gotenberg` (no separate Nginx — see below) |
| Database | `insolvency_vdr` (user `vdr_user`) | `insolvency_vdr_staging` (user `vdr_staging_user`) — separate Postgres container, separate volume, separate credentials |
| Redis | separate container, separate volume | separate container, separate volume |
| Uploads | volume `variedreach-vdr_backend_uploads` | volume `variedreach-vdr-staging_backend_uploads` |
| `.env` files | `apps/backend/.env`, `apps/frontend/.env.local` under `/opt/variedreach-vdr` | own copies under `/opt/variedreach-vdr-staging` — different secrets, different `FRONTEND_URL`/`NEXT_PUBLIC_API_URL` |
| Mail | real transactional email via Resend, `noreply@vdr.variedreach.com` | also real Resend, same address, `[STAGING] ` subject prefix — see §6 |
| SSL certificate | `/etc/letsencrypt/live/vdr.variedreach.com/` | `/etc/letsencrypt/live/staging.vdr.variedreach.com/` — separate Let's Encrypt certificate, separate renewal record |
| Backups | `/var/backups/insolvency-vdr/`, cron at 2am | `/var/backups/insolvency-vdr-staging/`, cron at 2am (same time, fully independent files) |

**The one shared component is Nginx.** Only one process can bind ports 80/443 on the VPS, so
production's existing `vdr_nginx` container also proxies `staging.vdr.variedreach.com` via a second
`server` block in `infrastructure/nginx/nginx.conf`. To reach staging's containers, `vdr_nginx` is
attached to a second Docker network, `vdr_edge` (external, created once with
`docker network create vdr_edge`), which staging's `backend`/`frontend` services also join under
the aliases `staging-backend`/`staging-frontend` (see `docker-compose.staging.yml`). Production's
own `backend`/`frontend`/`postgres`/`redis` are **never** on `vdr_edge` — Nginx can reach staging,
but staging's containers have no network path to production's database, Redis, or uploads, and
vice versa.

This means a config mistake in the staging `server` block is a routing-only risk (caught by
`nginx -t` before every reload, which fails closed — the previous working config stays loaded if
the test fails) — it cannot read or write production's data.

## 3. First-time setup (already done — for reference / rebuilding)

```bash
# 1. Clone the staging checkout
mkdir -p /opt/variedreach-vdr-staging
cd /opt/variedreach-vdr-staging
git clone --branch development https://github.com/merohit431-rgb/variedreach-vdr.git .

# 2. Create the shared edge network (once)
docker network create vdr_edge

# 3. Create apps/backend/.env, apps/frontend/.env.local, and a top-level .env
#    (STAGING_POSTGRES_PASSWORD=...) with staging-specific secrets/credentials —
#    never copy production's .env files verbatim.

# 4. Bring up the stack
docker compose -p variedreach-vdr-staging \
  -f docker-compose.yml -f docker-compose.staging.yml up -d --build

# 5. Schema + seed data
docker exec vdr_staging_backend npx prisma db push --schema=apps/backend/prisma/schema.prisma
docker exec -w /app/apps/backend vdr_staging_backend npx prisma db seed

# 6. Connect production's Nginx to the edge network (live, zero downtime)
docker network connect vdr_edge vdr_nginx

# 7. On the PRODUCTION checkout: add the staging server block to nginx.conf and
#    vdr_edge to the nginx service's networks in docker-compose.prod.yml (already
#    done — see git history), then bootstrap a dummy cert and request the real one:
LIVE_DIR="/opt/variedreach-vdr/infrastructure/nginx/letsencrypt/live/staging.vdr.variedreach.com"
mkdir -p "$LIVE_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout "$LIVE_DIR/privkey.pem" \
  -out "$LIVE_DIR/fullchain.pem" -subj "/CN=staging.vdr.variedreach.com"
cd /opt/variedreach-vdr
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build nginx
rm -rf "$LIVE_DIR" infrastructure/nginx/letsencrypt/archive/staging.vdr.variedreach.com \
  infrastructure/nginx/letsencrypt/renewal/staging.vdr.variedreach.com.conf
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot --email <email> --agree-tos --no-eff-email \
  --cert-name staging.vdr.variedreach.com -d staging.vdr.variedreach.com
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload

# 8. Cron + backups
mkdir -p /var/log/insolvency-vdr-staging /var/backups/insolvency-vdr-staging
chmod +x /opt/variedreach-vdr-staging/infrastructure/scripts/backup-db-staging.sh
# add to crontab:
# 0 2 * * * /opt/variedreach-vdr-staging/infrastructure/scripts/backup-db-staging.sh >> /var/log/insolvency-vdr-staging/backup.log 2>&1
```

Step 6's rebuild briefly recreates production's `backend`/`frontend`/`nginx` containers (Compose
recreates `depends_on` services along with the named one) — expect a few seconds of blips, not an
outage. Do this kind of Nginx-image change at a quiet time if it's ever repeated.

## 4. Day-to-day: deploying an update to staging

```bash
ssh vdr
cd /opt/variedreach-vdr-staging
git pull origin development
docker compose -p variedreach-vdr-staging \
  -f docker-compose.yml -f docker-compose.staging.yml up -d --build
# if the Prisma schema changed:
docker exec vdr_staging_backend npx prisma db push --schema=apps/backend/prisma/schema.prisma
```

This only touches staging's own containers — production is completely unaffected by anything in
this section. No SSH access needed for Rohit to review: just visit `https://staging.vdr.variedreach.com`.

## 5. Promoting staging to production (after approval)

Once a round of changes is approved on staging:

```bash
# Locally
git checkout main
git merge development      # or merge a specific reviewed commit/PR
git push origin main

# On the VPS
ssh vdr
cd /opt/variedreach-vdr
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# if the Prisma schema changed:
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend sh -c \
  "cd apps/backend && npx prisma db push"
```

`development` keeps going after this — it doesn't get reset or deleted. The next round of work
continues on it and goes through the same staging review before its turn to merge into `main`.

## 6. Staging email

Staging sends real email through Resend (`MAIL_PROVIDER=resend` in its `.env`), the same
`noreply@vdr.variedreach.com` sending identity as production — there's no separate staging sending
domain. Every subject line gets a `[STAGING] ` prefix (`APP_ENVIRONMENT=staging` in the `.env`
drives this) so staging mail is never mistaken for the real thing in an inbox. This means staging
testing does consume the real Resend quota and lands in real inboxes — invite real test addresses
deliberately, not production users' actual emails.

Local dev still uses MailHog (`MAIL_PROVIDER=nodemailer`, the default) — only staging and
production talk to the real Resend API. Every send, on either provider, is logged to the
`email_logs` table (`status`: `SENT`/`FAILED`/`DELIVERED`/`BOUNCED`) for troubleshooting.

Resend's delivery/bounce webhook (`POST /api/v1/webhooks/resend`) needs a one-time manual step in
the Resend dashboard per environment: add a webhook endpoint pointing at
`https://staging.vdr.variedreach.com/api/v1/webhooks/resend`, select at least
`email.delivered`/`email.bounced`, then copy the signing secret into that environment's
`RESEND_WEBHOOK_SECRET`. Until that's done, sends still work — `email_logs` rows just stay `SENT`
forever instead of advancing to `DELIVERED`.

## 7. Verifying isolation

If isolation is ever in doubt, these all show two completely independent stacks:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"               # 6 prod + 5 staging containers, distinct names
docker volume ls | grep -E "variedreach-vdr(-staging)?_"          # no name overlaps
diff <(docker exec vdr_backend env | sort) <(docker exec vdr_staging_backend env | sort)
docker exec vdr_postgres psql -U vdr_user -d insolvency_vdr -t -c "SELECT count(*) FROM users;"
docker exec vdr_staging_postgres psql -U vdr_staging_user -d insolvency_vdr_staging -t -c "SELECT count(*) FROM users;"
ls /opt/variedreach-vdr/infrastructure/nginx/letsencrypt/live/        # vdr.variedreach.com only
ls /var/backups/                                                   # insolvency-vdr/ and insolvency-vdr-staging/, separate
```

## 8. Gotchas specific to staging

- **`docker-compose.staging.yml` overrides every `container_name`.** The base `docker-compose.yml`
  hardcodes names like `vdr_postgres`/`vdr_backend` — without the override, staging's containers
  would collide directly with production's running containers of the same name. If you add a new
  service to the base file, give it a `vdr_staging_*` container name override here too.
- **No migration files exist in this repo** (`prisma db push`, not `migrate dev`/`migrate deploy`
  — see the note in DEPLOYMENT.md §3). Use `db push` for staging's schema too.
- **The shared Nginx is production-owned.** Edits to `infrastructure/nginx/nginx.conf` or the
  `nginx` service in `docker-compose.prod.yml` happen on the production checkout and go straight to
  `main` (§1's exception) — they are never staged through `development` first, since `main` is what
  the live Nginx container actually builds from.
- **`vdr_edge` is created once, manually, outside both Compose projects** (`docker network create
  vdr_edge`) and referenced as `external: true` in both `docker-compose.prod.yml` (nginx service)
  and `docker-compose.staging.yml` (backend/frontend services). Neither `docker compose down` nor
  `down -v` removes an external network, so this survives normal stack restarts — but don't run
  `docker network prune` without checking it's not unused-and-removed (it is in use whenever staging
  is running, but would show as unused if staging's containers are ever fully stopped).
