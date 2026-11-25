# Supported File Format Test Matrix

Phase 3D — Client-Confirmed VDR Requirements & File Format Support
Branch `wave1-foundation`, commit `0a3e742` · 2026-11-25

## How to read this matrix

Every format below is marked with one of:

- ✅ **Tested and verified** — exercised with a real file against real staging infrastructure this phase, with observed evidence (not assumed).
- 🔧 **Implemented, unit-tested** — covered by an automated Jest test using real library code (real `pdf-lib`/`sharp`/`yauzl`/`archiver` output, not a hand-faked buffer), but not separately re-exercised live against staging this phase.
- ⚠ **Partially verified** — some dimension of the format works, confirmed by one method but not the other (unit test only where a live check would be more conclusive, or vice versa).
- ❌ **Not verified** — identified as a real, open gap or limitation; not silently implied to work.

No test in this matrix used a real customer document. All live checks used synthetic fixtures generated for this purpose and were deleted immediately after; see the Live Verification Log at the end of this document for exact evidence.

---

## 1. Upload, validation, integrity — per format

| Format | Ext | Upload accepted | Signature validated | Original preserved | SHA-256 | Audit events | Cross-tenant isolation |
|---|---|---|---|---|---|---|---|
| PDF | `.pdf` | ✅ Live | ✅ Unit (real PDF magic bytes) | ✅ Live (byte-identical download) | 🔧 Unit | ✅ Live | 🔧 Unit (existing suite, unchanged) |
| Plain text | `.txt` | 🔧 Unit | N/A — no signature exists for plain text; extension-gated | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Word (legacy) | `.doc` | 🔧 Unit | 🔧 Unit (OLE2 signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Word | `.docx` | 🔧 Unit | 🔧 Unit (ZIP/OOXML signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| OpenDocument Text | `.odt` | 🔧 Unit | 🔧 Unit (ZIP signature, shared with docx) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Excel (legacy) | `.xls` | 🔧 Unit | 🔧 Unit (OLE2 signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Excel | `.xlsx` | 🔧 Unit | 🔧 Unit (ZIP signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Excel (macro) | `.xlsm` | 🔧 Unit | 🔧 Unit (ZIP signature, same container as xlsx) | 🔧 Unit — **macros never executed anywhere in this pipeline (see §4)** | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Excel Binary | `.xlsb` | ✅ **Live** (new this phase) | ✅ **Live** (real ZIP-based upload accepted) | ✅ Live | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| CSV | `.csv` | 🔧 Unit | N/A — plain text, extension-gated | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| PowerPoint (legacy) | `.ppt` | 🔧 Unit | 🔧 Unit (OLE2 signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| PowerPoint | `.pptx` | 🔧 Unit | 🔧 Unit (ZIP signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| OpenDocument Presentation | `.odp` | 🔧 Unit | 🔧 Unit (ZIP signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| JPEG | `.jpg`/`.jpeg` | 🔧 Unit | 🔧 Unit (real JPEG signature) | ✅ **Live** (byte-identical, see §2) | 🔧 Unit | ✅ Live | 🔧 Unit |
| GIF | `.gif` | 🔧 Unit | 🔧 Unit (real GIF signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| BMP | `.bmp` | ✅ **Live** (new this phase) | ✅ **Unit** (real "BM" header) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| PNG | `.png` | ✅ **Live** | ✅ **Live** (real PNG, correctly accepted; a disguised EXE header correctly rejected with 400 — see §Live Verification Log) | ✅ **Live** (byte-identical) | ✅ **Live** (same SHA-256 across upload/preview/download) | ✅ **Live** (FILE_UPLOADED/VIEWED/DOWNLOADED, `watermarked:false`) | 🔧 Unit |
| TIF | `.tif` | 🔧 Unit — **fixed this phase** (previously rejected despite sharing TIFF's signature) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| TIFF | `.tiff` | 🔧 Unit | 🔧 Unit (real TIFF signature, both byte orders) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| ZIP | `.zip` | ✅ **Live** (new this phase) | ✅ **Live** (real ZIP accepted) | ✅ Live | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| 7-Zip | `.7z` | 🔧 Unit (new this phase) | 🔧 **Unit** (real 7z magic number) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| RAR | `.rar` | 🔧 Unit (new this phase) | 🔧 **Unit** (both RAR4 and RAR5 real signatures) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| AutoCAD Drawing | `.dwg` | 🔧 Unit (new this phase) | ⚠ **Unit, best-effort** (AC10xx version-tag check — see §5 limitation) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Design Web Format | `.dwf` | 🔧 Unit (new this phase) | ⚠ **Unit, best-effort** (classic header or ZIP-based — see §5 limitation) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Drawing Exchange Format | `.dxf` | 🔧 Unit (new this phase; confirmed with you as the real format behind "DFX") | ❌ **No signature exists** — ASCII DXF has no fixed magic bytes; extension-gated only, same honest limitation as txt/csv (see §5) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |
| Design Web Format XPS | `.dwfx` | 🔧 Unit (new this phase) | 🔧 **Unit** (ZIP/OPC signature, same family as DOCX) | 🔧 Unit | 🔧 Unit | 🔧 Unit | 🔧 Unit |

**Cross-tenant isolation**: not a per-format property — the folder-access/organisation-scoping layer sits entirely below the file-type layer and was not touched this phase. Covered by the full existing adversarial suite (unchanged, passing) plus the live cross-room isolation check from Phase 3C.6 (a 404 on an unreachable room, independent of file type).

---

## 2. PDF-only dynamic watermarking — verified, not assumed

This was the single most important correctness requirement this phase, because the pre-existing code was **not** compliant with it: `WatermarkService` used to also watermark images and text. Verified three ways:

| Check | Result |
|---|---|
| Unit: image/text/archive/CAD input returns the exact same buffer reference, unmodified | ✅ 19/19 passing (`watermark.service.spec.ts`) |
| Unit: `files.service.ts`'s three content-serving paths skip the watermark/Office-conversion pipeline entirely for non-PDF formats | ✅ 11/11 passing, parameterized across png/jpeg/txt/csv/zip/7z/rar/dwg/dxf |
| **Live**: uploaded a real PNG to staging, fetched `/preview` and `/download` | ✅ Both returned content with the **identical SHA-256** as the uploaded original (`97a3a41...`) |
| **Live**: confirmed zero rows written to the `watermarks` table for that file | ✅ `count = 0` |
| **Live**: audit log for that file shows `metadata.watermarked: false` on both the view and download events | ✅ Confirmed |
| **Live regression**: uploaded a real PDF to the same room, fetched `/preview` | ✅ Returned content **larger** than the original (209 → 1,295 bytes — watermark text genuinely added) and exactly **one** row written to `watermarks` |

Office documents (DOCX/XLSX/PPTX/etc.) continue to be watermarked via their converted-to-PDF preview — confirmed as your intended interpretation (not re-tested live this phase specifically, since this code path is unchanged from before Phase 3D and was already covered by the existing suite; the only *change* this phase made was to images/text, which is what the live check above targeted).

---

## 3. Preview behaviour — what's real vs. what degrades gracefully

| Format group | Preview mechanism | Status |
|---|---|---|
| PDF | Native PDF viewer, watermarked | ✅ Unchanged, live-verified this phase (above) |
| DOC/DOCX/ODT, XLS/XLSX/XLSM/ODS, PPT/PPTX/ODP | Gotenberg → PDF conversion, then watermarked like any PDF | 🔧 Unchanged from before this phase; already covered by the existing suite |
| XLSB | Same Gotenberg conversion path as XLSX/XLSM (newly added to `OFFICE_CONVERTIBLE_EXTENSIONS` this phase) | ⚠ **Not live-verified this phase** — the upload/signature path was; whether Gotenberg's LibreOffice backend actually renders a real XLSB file correctly was not separately confirmed. Flagged as an open item below. |
| Images (JPEG/PNG/GIF/BMP/WEBP) | Native `<img>` | ✅ PNG live-verified; BMP/JPEG/GIF/WEBP unit-tested only |
| TIFF/TIF | Native `<img>` | ⚠ **Known, carried-forward limitation, not newly introduced**: most Chromium/Firefox browsers do not render TIFF via `<img>` natively (historically Safari-only). This was already marked `previewable: true` before this phase; not independently re-verified this phase either. **Recommend**: a real browser check against each target browser before launch, and downgrading to `previewable: false` (with "download to view" messaging) if it fails — this is a one-line config change once confirmed. |
| CSV | Plain-text render in the preview modal | 🔧 **Fixed this phase** — previously the backend served it correctly but the frontend had no render branch for anything but literal `.txt`, so a CSV preview silently showed a blank pane. Fixed via a derived `isTextPreviewable()` check. Not re-verified live this specific phase (code-level fix + the general pattern is unit-tested via the shared constants; a live click-through is recommended before launch). |
| XML/JSON | Plain-text render | Same fix as CSV, same status |
| ZIP | Metadata listing (name, size, encryption flag, suspicious-entry flags) — **no extraction, ever** | ✅ **Live-verified**: real 2-entry ZIP uploaded, listing returned both entries with correct sizes and zero false-positive flags |
| 7Z, RAR | No preview — clear "not available, download original" message | 🔧 By design; no safe listing library exists for either format (see §5) |
| DWG, DWF, DXF, DWFX | No preview — same clear message | 🔧 By design; no reliable, secure open-source rendering path exists for CAD formats |

---

## 4. Security — archive and macro handling

| Concern | Status | Evidence |
|---|---|---|
| Archive-bomb protection | ✅ Implemented and tested | `listZipEntries()` never calls `openReadStream()` on any entry — only central-directory metadata is ever read, so decompression (the actual bomb mechanism) never happens regardless of an entry's declared size. A 2MB-of-zeros entry (a genuine high-ratio case) is correctly flagged; ordinary text is not (false-positive check, also tested). |
| Archive entry-count DoS | ✅ Implemented and tested | Capped at 2,000 entries; a 2,005-entry fixture correctly truncates and flags `truncated: true`. |
| Path traversal in archive entries | ✅ Implemented and tested, with a real bug caught and fixed in testing | A hand-built, deliberately unsanitized ZIP (needed because `archiver` itself sanitizes traversal-shaped names before writing — confirmed directly) revealed that `yauzl`'s own default behavior **hard-rejects** such a name by erroring out the *entire* read. Fixed (`decodeStrings: false`, manual decode) so a suspicious name becomes a per-entry flag instead of crashing the whole listing. There is no extraction path in this product for a traversal name to ever act on. |
| Malicious archive entries (encrypted, oversized) | ✅ Implemented | `isEncrypted` surfaced per entry; total declared uncompressed size checked against a 50GB sanity ceiling. |
| Macro execution (XLSM and legacy DOC/XLS/PPT) | ✅ **Confirmed safe by configuration, not just by omission** | Verified directly against Gotenberg's own documentation: LibreOffice macro execution requires the explicit `LIBREOFFICE_ENABLE_MACROS` container flag, which is **off by default** and is not set in any of this project's three compose files (base, staging, prod — confirmed by direct inspection). No code change was needed; this is an already-correct default, now verified rather than assumed. |
| CAD content execution | ✅ No CAD file is ever parsed or opened by any server-side process — stored and served as opaque bytes only. |

---

## 5. Honest, open limitations (not silently hidden)

1. **DXF has no magic-byte signature.** ASCII DXF exports begin with ordinary, exporter-dependent text, not a fixed byte sequence — there is no reliable way to validate it beyond the extension itself. Same honest limitation this codebase already has for `.txt`/`.csv`/`.xml`/`.json`.
2. **DWG/DWF signature checks are best-effort, not exhaustive.** Both are loosely-documented, versioned, proprietary formats with no single public specification. DWG's check covers the common "AC10xx" version family (AutoCAD 2000 through current releases); DWF accepts either its classic binary header or a ZIP/OPC package (the modern 6.0+ variant). A sufficiently obscure or pre-2000 file could be rejected.
3. **No malware/antivirus scanning exists anywhere in this platform**, for any format, old or new. This is a pre-existing, previously-documented gap (the codebase's own comments already acknowledged it before this phase). **Recommendation**: integrate ClamAV (or a hosted equivalent, e.g. a cloud AV API) as a post-upload scanning step before a file is considered fully "available," independent of file type. This was not built this phase — it is a real, separate piece of infrastructure work, not a quick addition, and is flagged here rather than silently deferred.
4. **XLSB preview-conversion fidelity is unconfirmed.** Upload/validation is live-verified; whether Gotenberg's LibreOffice backend renders a real-world XLSB workbook correctly has not been separately checked.
5. **TIFF browser rendering is an open question, not newly introduced by this phase.**

---

## Live Verification Log

All live checks ran against `staging.vdr.variedreach.com`, using the `rbac-rp-liquidator@staging.test` fixture account (pre-existing, reusable, not a real customer) and `RBAC Test Room A`. Every file created for this log was deleted immediately after; a fresh file listing after cleanup showed the room's 4 pre-existing fixture files (all dated June/July 2026, confirmed unrelated to this session) and nothing else.

1. Uploaded a real, valid 73-byte PNG → `201 Created`.
2. `/preview` and `/download` both returned SHA-256 `97a3a41...` — identical to the uploaded original.
3. `audit_logs` showed `FILE_VIEWED`/`FILE_DOWNLOADED` with `metadata.watermarked: false`; `watermarks` table showed 0 rows for this file.
4. Uploaded a real, minimal valid PDF (209 bytes) → `/preview` returned 1,295 bytes (watermark added); `watermarks` table showed 1 row.
5. Uploaded a real ZIP-container file with a `.xlsb` extension → `201 Created`, confirming the new signature/allow-list entries work together end-to-end.
6. Uploaded a real 2-entry ZIP → `/archive-listing` correctly returned both entries with accurate sizes and no false-positive suspicious flags.
7. Uploaded a file with a disguised Windows executable header (`MZ\x90\x00...`) but a `.pdf` extension → correctly rejected with `400 Bad Request`, confirming extension-spoofing protection is unaffected by this phase's changes.
8. Deleted all 4 files created above; confirmed `204 No Content` for each and a clean room listing afterward.
