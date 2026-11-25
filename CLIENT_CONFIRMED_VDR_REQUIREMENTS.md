# Client-Confirmed VDR Requirements — Phase 3D

Status snapshot as of commit `0a3e742`, branch `wave1-foundation`, 2026-11-25.
This document restates the client's confirmed requirements with a current implementation status against each — not a sales description, an engineering checklist.

## 1. File format support

| Format | Status |
|---|---|
| PDF, TXT, DOC, DOCX, ODT | ✅ Implemented (DOC/DOCX/ODT/PDF pre-existing; TXT pre-existing) |
| XLS, XLSX, XLSM, XLSB, CSV | ✅ Implemented (XLSB added this phase; others pre-existing) |
| PPT, PPTX, ODP | ✅ Implemented (pre-existing) |
| JPEG, GIF, BMP, PNG, TIF, TIFF | ✅ Implemented (BMP added this phase; TIF fixed this phase — was rejected despite sharing TIFF's signature) |
| ZIP, 7Z, RAR | ✅ Implemented — upload/validate/store/download for all three; metadata listing for ZIP only (see §2) |
| DWG, DWF, DXF, DWFX | ✅ Implemented — upload/validate/store/download only, no preview (see §4). **"DFX" in the original request confirmed with you to mean DXF** (Drawing Exchange Format) — there is no file format actually called DFX. |

No format from the confirmed list was silently omitted. Full per-format test evidence is in `SUPPORTED_FILE_FORMAT_TEST_MATRIX.md`.

## 2. Dynamic watermarking — PDF only

**Status: ✅ Implemented and live-verified this phase, correcting a real pre-existing gap.**

Before this phase, the watermarking service also watermarked images and text files — not compliant with this requirement. Fixed:
- PDF files (native uploads and an Office document's converted-to-PDF preview) are watermarked dynamically, with user-identifying information, visibly positioned, PDF readability preserved.
- The original uploaded file is never overwritten — confirmed by construction (watermarking always produces a new in-memory buffer; the stored original is only ever read, never written, on any content-serving path).
- A watermarked PDF cannot be used to retrieve the unwatermarked original — original-file access is a separate, more strictly permissioned endpoint (`canDownloadOriginal`), unchanged by this phase.
- Non-PDF formats are never watermarked, never silently converted, and original files remain fully downloadable per the caller's existing permissions.
- Watermark/download activity is recorded in the audit log for every file, PDF or not — a `watermarked: true/false` field now distinguishes which actually happened.

Live-verified: a real PNG and a real PDF were both uploaded to staging; the PNG came back byte-identical on preview/download (zero watermark rows written); the PDF came back larger with a watermark applied (one watermark row written). See the test matrix for the exact evidence.

## 3. File upload and storage

| Requirement | Status |
|---|---|
| Extension validation | ✅ Implemented (pre-existing, extended to new formats) |
| MIME/signature validation, not extension alone | ✅ Implemented — real byte-signature checks for every format where one exists; see §5 for the 3 formats (TXT/CSV/DXF-class) where none can exist |
| Upload size limits, large-file handling | ✅ Pre-existing, format-agnostic (2GB ceiling, disk-streamed, not memory-buffered) — confirmed unaffected by new formats |
| Original filenames/extensions preserved | ✅ Pre-existing |
| SHA-256 checksums | ✅ Pre-existing, format-agnostic |
| Version history | ✅ Pre-existing, format-agnostic |
| Prevent accidental overwrite | ✅ Pre-existing (UUID-prefixed storage paths; a new version never touches a prior version's bytes) |
| Upload/replace/download/delete events audited | ✅ Pre-existing, format-agnostic |
| Organisation/folder permission enforcement, cross-tenant prevention | ✅ Pre-existing, untouched by this phase |
| Archive-bomb/path-traversal/malicious-entry protection | ✅ Implemented this phase (ZIP listing only — see the test matrix §4 for the real bug found and fixed during testing) |
| XLSM macros preserved, never executed | ✅ Confirmed — no code in this pipeline ever executes file content of any kind |
| CAD files preserved, no embedded content executed | ✅ Confirmed — CAD files are stored/served as opaque bytes only |

## 4. Preview and download behaviour

Implemented per format exactly as scoped in the test matrix (§3 there). Nothing is claimed previewable that isn't actually implemented and at least unit-verified; two items are flagged as not yet independently confirmed (XLSB real-world conversion fidelity, TIFF browser rendering) rather than assumed to work.

## 5. Security

Covered in detail in the test matrix (§4–5). Summary: MIME/signature validation is real (not extension-only); archive handling has explicit, tested bomb/traversal/DoS protections; macro execution is confirmed disabled at the Gotenberg level by configuration; no code anywhere executes uploaded content. **One honest, pre-existing gap, now formally documented rather than left implicit**: no malware/antivirus scanning exists for any file type. Recommended fix: ClamAV or a hosted AV API as a post-upload scanning step — not built this phase; flagged for a separate, scoped piece of work.

## 6. Reference implementation — existing IPO client (ARCK) protection

No IPO client data, documents, credentials, or configuration were touched, copied, or read beyond what this phase's synthetic test fixtures needed. File-format support is implemented as shared application code (this product's multi-tenant architecture has no per-organisation format allow-list), so it becomes available to every organisation identically, including ARCK, without any ARCK-specific change. The one ambiguity surfaced during discovery and not yet resolved: this requirement refers to "the new client's environment" as though a second real customer organisation already exists in the system; none does today beyond ARCK and pre-existing test organisations. If a specific new client exists, please confirm so any client-specific onboarding (not file-format support itself, which is global) can be scoped separately.

## 7. Anthropic API

**Unchanged, as instructed.** `CLAUDE_API_ENABLED` remains unset (defaults to `false`) in every environment, confirmed directly on both staging and production containers this phase. No API key configured, no paid calls made, no code touching the Claude/Anthropic integration was modified. Classification stands: **Implemented — Commercially Pending — Disabled.**

## 8. Production launch readiness

See `VDR_PRODUCTION_RELEASE_PLAN.md` for the full plan. Production deployment itself was not performed and will not be performed without your separate, explicit approval.
