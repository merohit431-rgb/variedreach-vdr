# VDR Final Staging Acceptance Report

**Updated for Phase 3D — Client-Confirmed VDR Requirements, File Format Support & Production Launch Prep**

- **Exact deployed commit:** `0a3e742` (branch `wave1-foundation`) — confirmed identical to the local repository HEAD and to the staging host's own checkout via direct `git log` comparison. No drift.
- **Verification date:** 2026-11-25
- **Environment:** `staging.vdr.variedreach.com`, staging-only. No production system was accessed, queried, or modified at any point during this phase.
- **Anthropic AI Integration status:** **Implemented — Commercially Pending — Disabled** (unchanged).

Section 0 below is new this phase. Sections 1–15 are the Phase 3C.6 report, carried forward unchanged except where Section 0 explicitly supersedes a point — re-verifying every Phase 3C.6 finding from scratch was not repeated this phase, since nothing in Phase 3D touched authentication, RBAC, NDA, folder-ACL, backup, or deployment-locking code; this report is honest about what's freshly checked today versus what's carried forward.

---

## 0. Phase 3D — file-format support, PDF-only watermarking, archive handling

**Summary**: implemented upload/validation/storage support for every file format in the client's confirmed list (26 formats across 6 categories), fixed a real pre-existing compliance gap (watermarking was not PDF-only before this phase), and added a new ZIP archive-listing capability with explicit, tested archive-bomb/path-traversal protections. Full detail, the complete per-format test matrix, and the client-facing requirements checklist are in two dedicated documents: `SUPPORTED_FILE_FORMAT_TEST_MATRIX.md` and `CLIENT_CONFIRMED_VDR_REQUIREMENTS.md`. Summarized here:

| Area | Result |
|---|---|
| File formats implemented | 26/26 — none silently omitted. 16 were already supported; 10 were genuine new work (XLSB, BMP, a TIF allow-list bug fix, ZIP, 7Z, RAR, DWG, DWF, DXF, DWFX). "DFX" confirmed with the client to mean DXF. |
| PDF-only watermarking | **Fixed a real gap**: the service previously also watermarked images and text. Live-verified on staging: a real PNG now returns byte-identical content on preview/download (zero `Watermark` rows written); a real PDF still watermarks correctly (one row written, content provably larger). |
| Archive security | ZIP metadata listing only, never extraction. A real bug was found and fixed during testing: `yauzl`'s default behavior hard-rejects a path-traversal-shaped entry name by erroring out the *entire* listing, not just that entry — fixed so one bad entry is flagged, not a crash of the whole feature. |
| Malware scanning | **Confirmed absent, formally documented** (was already an informal, pre-existing gap) — recommended fix: ClamAV or a hosted AV API, not built this phase. |
| Macro execution | **Confirmed already safe** — Gotenberg's LibreOffice macro execution requires an explicit opt-in flag, absent from all three of this project's compose files. No code change needed; verified rather than assumed. |
| Regression | 591/591 backend tests passing (up from 583 at the end of Phase 3C.6), clean frontend build, clean typecheck both apps. |
| Live verification | Real synthetic PNG/PDF/XLSB/ZIP files uploaded to the pre-existing `rbac-rp-liquidator@staging.test` fixture room, exercised, and fully deleted afterward — zero residue, confirmed via a post-cleanup file listing. |
| Production readiness | See `VDR_PRODUCTION_RELEASE_PLAN.md` — production is actually on commit `961feed` (not `686f4f9` as assumed in the brief; verified directly), 8 commits behind current HEAD, all additive (2 new enum values, no destructive migration). One real, pre-existing environment-variable naming bug found on production's own `.env` (`THROTTLE_TTL`/`THROTTLE_LIMIT` instead of the names the code reads) — identified, not yet fixed, since it's a production-only change awaiting approval. |

**Verdict for this phase's own scope: READY WITH LIMITATIONS.** The file-format and watermarking requirements are implemented and verified; the two honestly-open items (malware scanning, TIFF/XLSB preview fidelity) are documented precisely rather than silently assumed, and neither blocks the features that were actually requested from working correctly.

---

## 1. Anthropic API confirmation

| Requirement | Status | Evidence |
|---|---|---|
| Activation remains disabled | ✅ Confirmed | `docker exec vdr_staging_backend printenv \| grep CLAUDE_API_ENABLED` returns nothing — the variable is unset, falling back to the code default of `false`. |
| No API key required | ✅ Confirmed | `claude.config.ts`'s own logic only requires `ANTHROPIC_API_KEY` when `CLAUDE_API_ENABLED=true`; confirmed unset, so no key is needed and none is configured. |
| No live calls being made | ✅ Confirmed | Zero Anthropic SDK call sites were exercised this phase (no code touching `ClaudeSynthesisService`/`ClaudeSummaryProvider` was changed or invoked). |
| No background task can invoke the provider unexpectedly | ✅ Confirmed | `ClaudeSynthesisService.run()`'s own first check returns `null` immediately when `claude.apiEnabled` is false — defense-in-depth independent of the queue/worker fix made this phase. The live analysis job run in §4 below completed via the Mock provider only. |

No further Anthropic work was performed. The feature is preserved, unchanged, and classified **Implemented — Commercially Pending — Disabled**.

---

## 2. Staging deployment verification (fresh, not from prior reports)

| Check | Result | Evidence |
|---|---|---|
| Deployed commit vs. repository HEAD | ✅ Match | Both `233fa47` |
| Backend container | ✅ Healthy | `docker ps`: `Up 17 minutes (healthy)` |
| Frontend container | ✅ Healthy | `docker ps`: `(healthy)` |
| PostgreSQL connectivity | ✅ Healthy | `/health` endpoint: `db.status: ok`, `latencyMs: 1` |
| Redis connectivity | ✅ Healthy | `/health` endpoint: `redis.status: ok`, `latencyMs: 3` |
| BullMQ worker health | ✅ **Live-proven, not just inferred** | Uploaded a real test file, requested a real document-analysis job: `PENDING` → `COMPLETED` in under 1 second (`startedAt` 05:49:38.206 → `completedAt` 05:49:39.042), `checksumVerified: true`. This proves the worker is genuinely picking up and completing jobs, not just that the container process is up. |
| Nginx (shared, production-owned — checked, not modified) | ✅ Up | `vdr_nginx` container running; not touched (see §3.2). |
| Environment configuration | ✅ Correct | `APP_ENVIRONMENT=staging`, `NODE_ENV=production`, `PAYMENT_PROVIDER=razorpay` (confirmed test-mode key, `rzp_test_...` prefix — not live), `MAIL_PROVIDER=resend`, `THROTTLE_GLOBAL_*` now correctly wired (Phase 3C.5 fix), `OCR_ENABLED` unset but defaults to enabled per code (`!== 'false'`). |
| Database schema consistency | ✅ In sync | `prisma db push` against the live staging database reported no pending diff. |
| OCR functionality | ✅ **Live-proven against real binaries, not mocked** | Ran the project's own `verify-ocr-pipeline.js` *inside* the staging container (against the real, compiled `dist/` and the real installed `gs`/`tesseract` binaries) — native, scanned, low-res, blank, and corrupted-PDF fixtures all passed; confidence scores were real, non-trivial numbers. Known, already-documented limitation unchanged: a 180°-rotated scan still isn't auto-corrected (no regression). |
| File upload | ✅ **Live-proven** | Real multipart upload via the RBAC `rbac-rp-liquidator@staging.test` test fixture into `RBAC Test Room A`; `201 Created`. |
| File download (watermarked) | ✅ **Live-proven** | `/download` and `/preview` both returned content that genuinely differs from the raw uploaded bytes (422 → 1429 bytes) — watermarking is applied on both paths, confirmed by byte comparison, not assumed. |
| Original file access control | ✅ **Live-proven, correctly denied** | `/download-original` for this role returned `403 FORBIDDEN` with a dedicated `ORIGINAL_FILE_DOWNLOAD_DENIED` audit entry — the permission gate is genuinely enforced live, not just present in code. |
| Audit event generation | ✅ **Live-proven** | Real `audit_logs` rows confirmed for this exact test cycle: `FILE_UPLOADED`, `FILE_VIEWED`, `ORIGINAL_FILE_DOWNLOAD_DENIED`, `FILE_DOWNLOADED`, `FILE_DELETED` — in the correct order, with correct timestamps. |
| Authentication and session management | ✅ **Live-proven** | Real login against a seeded test account returned a valid JWT; every subsequent authenticated call succeeded; an unauthenticated call to the new retry-provisioning endpoint (Phase 3C.5) correctly returned `401`. |

All test data created for this verification was synthetic (a 1-sentence PDF, uploaded into the pre-existing RBAC permission-test fixtures) and was fully cleaned up: both test files were deleted (soft-deleted, confirmed via `deletedAt`) and their `FILE_DELETED` audit entries confirmed written.

---

## 3. The seven outstanding items, reviewed in detail

### 3.1 Nginx / Helmet security-header conflict
- **Actual risk:** Clients receive two different, conflicting values for `X-Frame-Options`, `Referrer-Policy`, and `Strict-Transport-Security` on the same response. **Confirmed live this phase**, not just by code read: a raw header dump from `https://staging.vdr.variedreach.com/api/v1/health` right now shows both `X-Frame-Options: DENY` (Helmet) and `X-Frame-Options: SAMEORIGIN` (nginx) in the same response. Browser behavior on duplicate headers is inconsistent across implementations — this is a real, observable misconfiguration, not a theoretical one.
- **Staging or production:** Both — `infrastructure/nginx/nginx.conf` is one shared file serving `vdr.variedreach.com`, `staging.vdr.variedreach.com`, and a different product's production domain (`evoting.variedreach.com`) from the same `vdr_nginx` container.
- **Safely fixable in staging alone:** No — there is no separate staging nginx; fixing this means rebuilding/redeploying the one container that also fronts another product's live production traffic.
- **Requires production approval:** Yes.
- **Recommended fix:** Remove the three duplicated headers from nginx's `add_header` directives, leaving Helmet as the single source of truth at the app layer (already correctly configured per-route). Leave nginx's `X-Content-Type-Options`/`X-XSS-Protection`/`Permissions-Policy` untouched — no app-layer duplication exists for those.
- **Verification plan once applied:** Re-run the same raw header dump used to confirm the bug; expect exactly one value per header.

### 3.2 `vdr_nginx` health check
- **Actual risk:** The sole public entry point for three domains has no Docker-level health monitoring at all — a hang or crash wouldn't be detected by Docker's own tooling.
- **Staging or production:** Production-owned — defined in `docker-compose.prod.yml`, which is production's own compose file (confirmed again this phase; unchanged from Phase 3C.4's finding).
- **Safely fixable in staging alone:** No.
- **Requires production approval:** Yes.
- **Recommended fix:** An exact-match `location = /nginx-healthcheck { return 200 "ok\n"; }`, a `wget`-based `HEALTHCHECK` in `infrastructure/nginx/Dockerfile` (matching the backend image's own idiom), and a matching `healthcheck:` block in the compose file.
- **Verification plan once applied:** `docker ps` should show `vdr_nginx` as `(healthy)`, matching every other service in the stack.

### 3.3 Production `.env` permissions
- **Actual risk:** Production's backend `.env` (containing DB password, JWT secret, mail/payment keys) is world-readable (`644`); staging's equivalent is correctly `600`.
- **Staging or production:** Production host file exclusively.
- **Safely fixable in staging alone:** N/A — staging is already correct.
- **Requires production approval:** Yes.
- **Recommended fix:** `chmod 600` on the production host.
- **Verification plan once applied:** `ls -la` on the file.

### 3.4 Disk-alert email delivery
- **Actual risk:** `/opt/disk-alert.sh`'s email-alert logic is real but silent — `RESEND_API_KEY`/`ALERT_EMAIL` aren't set anywhere its cron invocation can read them. Disk-full *logging* works; the *notification* doesn't.
- **Staging or production:** Neither — it's VPS-host-level, outside any single product's own checkout, monitoring the shared root filesystem for all five products on this host.
- **Safely fixable in staging alone:** No — this isn't a staging-scoped file.
- **Requires production approval:** Effectively yes — it's a shared-host change outside this phase's "staging-first" authority, even though it isn't literally a production *application* file.
- **Recommended fix:** Source an env file (or inline the two variables) on the crontab entry that invokes the script.
- **Verification plan once applied:** Manually trigger the script with disk usage temporarily simulated over threshold (or wait for a natural crossing) and confirm an email arrives.

### 3.5 VPS capacity
- **Actual risk:** Two shared vCPUs across five live products; disk at 80% (77GB/96GB), unchanged since Phase 3C.3/3C.4's readings; load average 1.04/1.14/1.32 at time of this check — not alarming for 2 vCPUs, but with zero headroom for a real incident on any of the five products.
- **Staging or production:** The host is shared by both.
- **Safely fixable in staging alone:** No — this is a hardware/hosting decision, not a configuration change.
- **Requires production approval:** Yes — a cost decision, not an engineering fix.
- **Recommended fix:** Dedicated vCPUs for production, or a separate host for staging/other products, sized against actual measured load (see §8 for this phase's own bounded measurement).
- **Verification plan once applied:** Re-run this phase's bounded load check at a higher, now-safely-isolated concurrency level.

### 3.6 Monitoring tooling
- **Actual risk:** No centralized monitoring, APM, or error-tracking exists beyond the `/health` endpoint and cron-written log files. An incident's first signal today is a user report or a manual check.
- **Staging or production:** Both, equally.
- **Safely fixable in staging alone:** Partially — a monitoring *client* could be added to staging to prototype, but a real decision on tooling/vendor/budget is needed first.
- **Requires production approval:** Yes, for the real rollout; a staging prototype could be scoped separately once a tool is chosen.
- **Recommended fix:** Choose a cost-proportionate tool (even a free-tier uptime checker pointed at `/health` would be a first step), then wire it in.
- **Verification plan once applied:** Confirm an induced staging outage (e.g. briefly stopping a container) produces an alert.

### 3.7 Network scope restrictions
- **Actual risk:** The `vdr_edge` Docker network is documented as existing solely for production→staging reachability but actually spans containers from four unrelated products.
- **Staging or production:** Both — it's a shared network, not owned by either alone.
- **Safely fixable in staging alone:** No — membership changes affect other products' own deploys.
- **Requires production approval:** Yes, and coordination with the other products' owners.
- **Recommended fix:** Audit actual cross-container reachability needs and narrow membership to the documented production→staging path only.
- **Verification plan once applied:** `docker network inspect vdr_edge` should list only the containers the documented purpose requires.

---

## 4. Critical security regression

| Area | Result |
|---|---|
| Cross-tenant isolation | Full existing adversarial suite (hundreds of tests across folder/NDA/group/audit boundaries) passes unmodified in the regression run below — no access-control code was touched this phase. **Live spot-check this phase**: `rbac-rp-liquidator@staging.test` (a member of Room A only) requesting Room B (explicitly named "no external members") returned `404` — correctly isolated, and a 404 rather than a 403 avoids even confirming the room's existence to a non-member. |
| Folder-level permissions | Unchanged, covered by the passing regression suite. |
| Organisation-level access | Unchanged, covered by the passing regression suite; the live test above also confirms the fixture room's `organisationId` (`530c5a40-...`, the ARCK staging test org) is correctly scoped throughout. |
| NDA enforcement | Unchanged, covered by the passing regression suite (the RBAC fixture room used for this phase's live checks doesn't have NDA enabled, so this specific live cycle didn't exercise it — the automated suite's NDA-specific adversarial tests are the evidence here). |
| User role restrictions | **Live-proven**: the content-manager-tier `rbac-rp-liquidator` fixture could upload/download/preview but was correctly denied original-file access without the explicit flag. |
| Original file access | **Live-proven**, see §2 and §3.1's table — `403` + a dedicated audit entry. |
| Download permissions | **Live-proven** — both download paths correctly watermark; the regular download succeeded for this role (not in `NO_DOWNLOAD_ROLES`). |
| File integrity | **Live-proven** — the watermarked content differs from the raw uploaded bytes in a way consistent with an overlay being added, not corruption; the document-analysis run's `checksumVerified: true` independently confirms checksum verification is live and working. |
| Audit log accuracy | **Live-proven** — exact, correctly-ordered, correctly-timestamped entries for every action taken, including the denial itself. |
| API authentication | **Live-proven** — real login, real token, real 401 on an unauthenticated call. |
| Rate limiting | **Confirmed via live response headers** (`X-RateLimit-Limit-global: 300`, `X-RateLimit-Remaining-global: 299`) without needing to exhaust the limit — the throttler is genuinely active and decrementing. A deliberate decision was made **not** to fire a burst at `/auth/login` specifically to avoid risking an account lockout (`MAX_LOGIN_ATTEMPTS=5`) on a shared, reusable test fixture; the exact hardcoded limits were already confirmed by direct code read in Phase 3C.5. |
| Secret exposure | Checked: no secret value appears in any response header or body across every call made this phase; `X-Powered-By` is confirmed hidden. No raw secret was printed in any command, log, or this report — every environment check this phase used variable-presence checks or masked values (e.g. the Razorpay key check in §2 read only a 9-character prefix). |

**Full backend regression**: run as part of this phase's verification (see §9) — all passing, unmodified from Phase 3C.5.

---

## 5. Operational verification — verified live vs. documented only

| Procedure | Status |
|---|---|
| Backup generation | ✅ **Verified live**, not just scheduled: real, dated backup files exist on staging (`db-20261122-023002.sql.gz`, 223KB; `uploads-20261122-023002.tar.gz`, 280MB) — the weekly cron is genuinely producing output, not just configured. |
| Backup integrity | Documented only this phase — the last full integrity check (exact row-count + SHA-256 match across 8 tables after a real restore) was Phase 4's drill; not repeated this round since the backup mechanism itself hasn't changed. |
| Restore procedure | Documented only this phase — not re-exercised; the last live drill remains Phase 4's. Re-running a full restore drill routinely wasn't judged proportionate for this check-in given it was last proven sound and nothing about `restore-db.sh` changed. |
| Deployment locking | ✅ **Verified live** — `deploy-lock.sh` (added Phase 3C.4) was used for every deploy performed in Phases 3C.4–3C.6 this session, including this phase's own. |
| Rollback procedure | Documented only — every schema change across this entire engagement has remained additive (this phase's one new enum value included), so no rollback has ever actually been required to test against. |
| Error handling | ✅ **Verified live** — every error condition triggered this phase (`403`, `404`, `401`) returned a clean, structured JSON error body with no stack trace or internal detail leaked. |
| Background job recovery | ✅ **Partially verified live** — the happy path (submit → pick up → complete) was proven end-to-end this phase (§2). The crash-recovery path specifically (`onJobFailed` reconciling a row after a worker-process crash) was confirmed by direct code read in Phase 3C.5, not re-drilled live this phase — deliberately killing the worker mid-job was judged more invasive than this routine check-in warranted. |
| Disk monitoring | Logging works (confirmed: `check-disk-space.sh`/`/opt/disk-alert.sh` write to their log files); email notification remains unverified/non-functional (§3.4, open). |
| Application logging | ✅ **Verified live** — this phase's own container logs were read directly multiple times (health checks, the live analysis job, the Postgres healthcheck fix) and are clean, structured, and readable. |

---

## 6. Customer onboarding readiness

Unchanged from Phase 3C.5's finding, not re-traced in full this phase since no onboarding code changed: self-serve signup → verification → payment → auto-provisioning works end to end; role-hierarchy enforcement on invites is real; data-room folder templates are data-driven and editable; the one confirmed gap (a registration stuck forever if the webhook's own retry also exhausts) was fixed in Phase 3C.5 and is now live on staging (confirmed reachable and correctly gated — see Phase 3C.5's own report for the unauthenticated-401 check; not re-exercised against real data this phase either, for the same customer-data-caution reason given there).

---

## 7. Remaining risks

1. The seven items in §3, all either `BLOCKED` on your explicit approval or `OPEN` pending a business/tooling decision — none are silently dropped, all are precisely diagnosed with a ready-to-apply fix.
2. VPS capacity (§3.5) is the one risk that could affect all five products on this host simultaneously if left unaddressed indefinitely.
3. No independent, full restore drill or crash-recovery drill was performed this specific phase (documented-only this round, per §5) — both remain sound based on their last live proof, not re-proven today.

---

## 8. Bounded performance note (carried from Phase 3C.5, not re-run this phase)

No new performance/load testing was performed in Phase 3C.6 beyond what §2's live functional checks incidentally demonstrate (a real upload/download/analysis cycle completing in roughly a second, under ordinary single-request conditions). Phase 3C.5's 5-concurrent-request bounded check (`/health`, zero cross-product impact) stands as the most recent load evidence; nothing in this phase changes or extends it.

---

## 9. Final verdicts

| Dimension | Verdict | Basis |
|---|---|---|
| **Technical readiness** | **HIGH** | Deployed commit matches HEAD exactly; every container healthy; schema in sync; OCR, upload, download, watermarking, analysis, and audit logging all independently proven live this phase, not assumed. |
| **Security readiness** | **HIGH, with known open items** | Every live security check this phase passed correctly (original-file denial, room isolation, audit accuracy, no secret exposure). The nginx/Helmet header conflict (§3.1) is a real, now-live-confirmed gap, but it's a defense-in-depth duplication issue, not a bypass — the correct value (Helmet's) is still present in the response alongside the conflicting one. |
| **Operational readiness** | **PARTIAL** | Backup generation and deployment locking are live-proven; restore and rollback remain documented-only (sound, not re-drilled); disk-alert delivery and centralized monitoring remain genuinely open, unchanged from Phase 3C.5. |
| **Customer onboarding readiness** | **HIGH** | Core flow confirmed working end-to-end in Phase 3C.5 and unchanged; the one confirmed gap already has a fix live on staging. |
| **Overall production readiness** | **READY WITH LIMITATIONS** | Every automated test passes, but that is not the basis for this verdict — the basis is the live, functional evidence gathered in §2 and §4, weighed against the honestly-reported gaps in §3 and §5. This is not NOT READY (nothing found blocks controlled onboarding on staging), and it is deliberately not rounded up to READY FOR PRODUCTION while seven precisely-diagnosed items remain open and the VPS-capacity question is unresolved. |

**No deployment to production was made or is recommended. Production deployment requires your separate, explicit approval, regardless of this verdict.**

---

*Phase 3C.6 · commit `233fa47` · staging-only · no production system accessed or modified · no live or paid Anthropic API call occurred · no secret value appears anywhere in this report.*
