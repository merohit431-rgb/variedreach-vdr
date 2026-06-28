# InsolvencyVDR — variedreach-vdr

A secure, auditable Virtual Data Room (VDR) platform purpose-built for the Indian Insolvency and
Bankruptcy Code (IBC) ecosystem — Resolution Professionals, Liquidators, Committee of Creditors,
Prospective Resolution Applicants, Auditors, and Legal Advisors sharing sensitive transaction
documents under CIRP, Liquidation, and M&A due diligence engagements.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS |
| Backend | NestJS 10 + TypeScript |
| Database | PostgreSQL 16 via Prisma ORM |
| Cache / Queues | Redis |
| Email (dev) | MailHog |
| Containerisation | Docker Compose |
| Reverse proxy (prod) | Nginx |

## Project structure

```
variedreach-vdr/
├── apps/
│   ├── backend/         # NestJS API (port 4000)
│   └── frontend/        # Next.js app (port 3000)
├── packages/
│   └── shared/          # Shared TypeScript types & constants
├── infrastructure/
│   ├── nginx/           # Reverse proxy config
│   └── docker/postgres/ # DB init scripts
├── docker-compose.yml       # Local development stack
└── docker-compose.prod.yml  # Production overlay
```

## Getting started

### Option A — Docker (recommended)

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.local.example apps/frontend/.env.local
docker compose up --build
```

Once Postgres is up, run the initial migration and seed a bootstrap admin (first time only):

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run prisma:triggers
docker compose exec backend npx prisma db seed
```

`prisma:triggers` adds database-level triggers that block UPDATE/DELETE on the audit_logs,
watermarks, and file_versions tables — these are append-only by design and the application never
writes to them that way, but the trigger means that holds even against a stray manual query. It's
not part of the Prisma migration history (triggers aren't representable in schema.prisma) so it's
a separate, idempotent step — safe to re-run any time, including after `prisma migrate reset`.

- Frontend: http://localhost:3000 — log in at `/login` with the seeded admin below
- Backend API: http://localhost:4000/api/v1/health
- Swagger docs: http://localhost:4000/api/docs
- MailHog UI: http://localhost:8025 (password-reset emails land here in dev)

**Seeded admin login** (from `apps/backend/.env.example` defaults — change `SEED_ADMIN_PASSWORD`
before going further than local dev):
- Email: `admin@insolvencyvdr.local`
- Password: `ChangeMe123!`

### Option B — Manual (without Docker)

Requires Node.js 20+, a local PostgreSQL 16 instance, and Redis.

```bash
npm install
cp apps/backend/.env.example apps/backend/.env   # edit DATABASE_URL to point at your Postgres
cp apps/frontend/.env.local.example apps/frontend/.env.local
npm run prisma:generate
npm run prisma:migrate
npm run prisma:triggers
npm run prisma:seed
npm run dev:backend     # terminal 1
npm run dev:frontend    # terminal 2
```

## Production deployment

```bash
cp apps/backend/.env.example apps/backend/.env       # then fill in real values, see below
cp apps/frontend/.env.local.example apps/frontend/.env.local
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:triggers
```

Before going further than local dev, in `apps/backend/.env`:
- Set `JWT_ACCESS_SECRET` and `COOKIE_SECRET` to real random values, at least 32 characters each
  (e.g. `openssl rand -base64 48`). The backend refuses to start with `NODE_ENV=production` if
  either is missing, still the documented dev placeholder, or under 32 characters — see
  `apps/backend/src/config/validate-production-env.ts`.
- Change `SEED_ADMIN_PASSWORD` away from the documented default before running `prisma db seed`
  against production data.
- Point `DATABASE_URL` at your production Postgres and `APP_URL`/`FRONTEND_URL` at your real domain.

Notes on the production stack:
- The Nginx config (`infrastructure/nginx/nginx.conf`) terminates plain HTTP only; put your TLS
  certificates at `infrastructure/nginx/certs` and extend the `server` block for port 443, or run
  this behind a managed load balancer/TLS terminator instead.
- `client_max_body_size` is set to 100MB to match the largest upload category — raise it if you
  raise `STORAGE_MAX_FILE_SIZE_BYTES`.
- Backend and frontend containers expose a Docker healthcheck against `/api/v1/health` and
  `/login` respectively; Nginx won't route to either until they report healthy.
- File uploads persist in the `backend_uploads` named volume — back this up; there is no S3/object
  storage migration in V1.0.

## Development workflow

This repository is built sprint-by-sprint, with one commit per completed module:

1. Initial Architecture
2. Database Schema
3. Authentication Module
4. Dashboard Module
5. Workspace Module (Organisation + Data Room management)
6. Folder Module
7. File Upload Module
8. Permissions Module
9. Audit Logs Module
10. Reports Module
11. Deployment Ready

Branches:

- `main` — stable, integrates completed sprints
- `sprint-1-auth` — project setup, database schema, authentication
- `sprint-2-vdr-core` — dashboard, organisations/data rooms, folders, file upload
- `sprint-3-permissions` — granular permission engine
- `sprint-4-cirp` — audit trail and reports (CIRP/NCLT compliance)
- `sprint-5-production` — deployment hardening

If you hit errors running this locally, share them and we'll fix them before moving to the next
module.

## Full specification

See the product requirements document for the complete 11-module spec, database schema,
permission matrix, and phased delivery plan.
