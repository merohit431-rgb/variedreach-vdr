# VDR Production Release Plan

Phase 3D — Section 12 deliverable. This is a **plan**, not an action — nothing in this document has been applied to production. Production deployment requires your separate, explicit approval after reviewing this plan.

## 1. Current production commit and branch — verified directly, not assumed

Production (`/opt/variedreach-vdr` on the VPS) is on branch **`wave1-foundation`**, commit **`961feed`** ("Phase 3C.3: production Claude activation gate + close 10 open Phase 4 findings", 2026-11-24).

This corrects an assumption in the original brief, which referenced commit `686f4f9` as production's current state. Checked directly: `686f4f9` (2026-09-21) is an **older** commit, already contained within `961feed`'s own history — production is considerably further along than that reference point, not behind it. `main` was not assumed to be the production branch; production's actual checkout was inspected directly via SSH.

## 2. Staging commit and branch — verified directly

Staging (`/opt/variedreach-vdr-staging`) is on the same branch, commit **`0a3e742`** (this phase's final frontend commit), confirmed identical to the local development HEAD.

## 3. Code differences — the full, exact gap

**8 commits**, oldest first:

| Commit | Summary |
|---|---|
| `479aee6` | Phase 3C.3: production environment configuration template |
| `80917e0` | Atomic AI budget reservation (replaces a check-only guard with a real `pg_advisory_xact_lock`-based reservation) |
| `9183d31` | BullMQ crash-risk fix, graceful shutdown hooks, dead throttle config cleanup, stuck-registration recovery endpoint |
| `233fa47` | Staging-only Postgres healthcheck fix (does not apply to production — see §4) |
| `449d22b` | Phase 3C.6 staging acceptance report (documentation only) |
| `02b9894` | Phase 3D: PDF-only watermarking fix + client-confirmed file-format support |
| `8da3c77` | Phase 3D: ZIP archive-listing capability |
| `0a3e742` | Phase 3D: frontend archive-listing UI, CSV preview fix |

No commit in this range touches Anthropic/Claude activation logic, production infrastructure, or customer data directly.

## 4. Database migration review

**Two commits touch `schema.prisma`**, both purely additive (new enum values, no column/table changes, no data migration):
- `80917e0` adds `RESERVED`/`RELEASED` to `AiUsageStatus`.
- `9183d31` adds `REGISTRATION_PROVISIONING_RETRIED` to `AuditAction`.

Applying these to production is a `prisma db push` (this project's established, non-destructive schema-sync method — no `migrations/` directory exists in this codebase, by established convention). **No destructive migration of any kind is required or recommended.** Phase 3D itself (file formats, watermarking, archives) introduced **zero** schema changes — it is entirely application-code and configuration.

## 5. Environment variable review — a real gap found and already fixed on staging

Comparing the current `.env.production.template` against what the commit range actually needs: the template itself was authored fresh in this range (`479aee6`), so it is new relative to production's current `.env`, which predates it.

**One concrete, verified issue**: production's real `.env` currently has `THROTTLE_TTL`/`THROTTLE_LIMIT`/`THROTTLE_AUTH_LIMIT` — checked directly on the live production container. These are **not** the variable names the code actually reads (`THROTTLE_GLOBAL_TTL`/`THROTTLE_GLOBAL_LIMIT`) — the same drift already found and fixed on staging this engagement. Production is currently silently running on the code's 60s/300-request default, not the 1000-request/900000ms values someone apparently intended. **Recommended action at deploy time**: rename these three variables in production's `.env` to the correct names, at the same values currently in effect (60/300), exactly as was done on staging — not the old, never-actually-applied 1000/900000 figures, to avoid silently changing real behavior as a side effect of a naming fix. This is a one-time, low-risk edit to a text file; not applied by this phase, since it touches production configuration directly.

No other new environment variables are required by anything in this 8-commit range.

## 6. Secret isolation

No secret value was printed, logged, or written to any file by this phase. Every environment check this phase and the preceding ones used variable-presence checks or masked values (e.g., reading only a Razorpay key's 9-character prefix to distinguish test vs. live, never the full key). Production's `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RAZORPAY_KEY_SECRET`, `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, and database password were not read, printed, or otherwise handled at any point.

## 7. Payment configuration verification

Not in scope for this phase's code changes (no payment code was touched). Carried forward from prior phases: production's `PAYMENT_PROVIDER=razorpay` with its own live credentials, unaffected by anything in this 8-commit range.

## 8. Mail configuration verification

Not in scope for this phase's code changes. Carried forward: production's `MAIL_PROVIDER=resend`, unaffected.

## 9. File storage compatibility

Confirmed compatible — the new file formats use the exact same storage interface (`IStorageService`, disk-streamed, UUID-prefixed paths, SHA-256 checksums) as every pre-existing format. No storage-layer change was made or is needed; `STORAGE_MAX_FILE_SIZE_BYTES` applies uniformly regardless of extension, as it already did.

## 10. Backup before deployment

Use the existing, already-tested procedure (`infrastructure/scripts/backup-db.sh` for production), documented in the VDR Operations Runbook. Given this release includes two additive schema changes, a fresh backup immediately before the `prisma db push` step is the recommended minimum — not because the migration is risky (it isn't: additive enum values only), but as standing practice for any production schema touch.

## 11. Deployment and rollback procedure

Follow the existing, already-documented procedure (VDR Operations Runbook, §3–4), unchanged by this phase:
1. Confirm the target container's own environment first (never assume).
2. `git pull` on the production checkout; confirm the expected commit landed.
3. Fix the `THROTTLE_*` variable names in production's `.env` (§5).
4. `prisma db push` for the two additive enum changes (§4), using the project's own `node_modules/.bin/prisma`, not `npx` (version-drift risk, previously documented).
5. Rebuild only the changed services (`docker compose ... up -d --build --no-deps backend frontend`), wrapped in `deploy-lock.sh` (added this engagement specifically to prevent a concurrent-deploy race).
6. Confirm the container reports healthy, then re-verify its environment variables match what was intended.
7. Run the smoke tests in §12 before considering the deployment complete.

**Rollback**: every change in this range is additive (code and schema both) — a rolled-back code version simply ignores the newer enum values and the newer file-format allow-list entries. `git checkout <previous commit>` + the same rebuild steps is sufficient; no down-migration has ever been required in this project's history and none is needed here.

## 12. Post-deployment smoke tests

1. `GET /api/v1/health` — expect `200`, `db.status: ok`, `redis.status: ok`.
2. Confirm `CLAUDE_API_ENABLED` remains unset on the production container (it must not be silently enabled by this deploy).
3. Upload a small synthetic PDF and a small synthetic image to a disposable or pre-authorized test room (never a real customer room); confirm the PDF watermarks and the image does not (byte-identical download), mirroring this phase's own staging verification exactly.
4. Confirm a pre-existing real customer file (read-only — `GET` the file's metadata only, do not download/modify) still has its expected `checksum`/`sizeBytes`, proving the deploy didn't disturb existing records.
5. Confirm the new `/archive-listing` route returns a clean `400` for a non-ZIP file and is reachable at all (routing sanity, not a full test).

## 13. Customer data integrity verification

Before and after the deploy, record: total `File` row count, total `FileVersion` row count, and the SHA-256 checksum of a small, fixed sample of existing files (read via the existing, already-permissioned API — no direct filesystem or database content access). All three must be identical before and after. This is the same discipline already used for every schema-touching deploy earlier in this engagement (e.g., the Phase 4 restore drill's exact row-count-and-checksum match).

---

## Summary verdict for this release

- **Technical risk**: Low. Every schema change is additive; every code change is covered by passing automated tests; the one real behavioral fix (PDF-only watermarking) was independently verified live on staging.
- **Configuration risk**: Low, with one known, already-scoped fix needed (`THROTTLE_*` variable renaming) — identified precisely, not vague.
- **Blockers requiring your approval before any production action**: the deployment itself, and the `.env` variable rename on the production host (a production configuration change, per the standing rule that any production-only action waits for explicit approval).

No production system was modified in the preparation of this plan.
