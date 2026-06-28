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

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/v1/health
- Swagger docs: http://localhost:4000/api/docs
- MailHog UI: http://localhost:8025

### Option B — Manual (without Docker)

Requires Node.js 20+, a local PostgreSQL 16 instance, and Redis.

```bash
npm install
cp apps/backend/.env.example apps/backend/.env   # edit DATABASE_URL to point at your Postgres
cp apps/frontend/.env.local.example apps/frontend/.env.local
npm run prisma:generate
npm run prisma:migrate
npm run dev:backend     # terminal 1
npm run dev:frontend    # terminal 2
```

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
