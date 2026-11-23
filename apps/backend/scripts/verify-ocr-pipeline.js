#!/usr/bin/env node
// Standalone, manually-run verification of the REAL Ghostscript/Tesseract
// binaries against real, generated PDF fixtures -- run under plain Node,
// outside Jest. Mirrors verify-pdf-extraction.js's own split: Jest specs
// (ocr.adapter.spec.ts, tesseract.util.spec.ts) mock child_process to test
// this feature's OWN orchestration/parsing logic; this script is what
// actually proves the real `gs`/`tesseract` CLIs (installed via apk, see
// Dockerfile) behave as expected -- genuinely meaningful only when run
// inside a container that has them, i.e. staging, not a local dev machine.
//
// Requires a prior `npm run build` (imports the COMPILED ghostscript.util/
// tesseract.util from dist/, not the TS source) -- this is deliberate: it
// exercises the exact code staging actually runs, not a reimplementation
// that could silently drift from it.
//
// Usage: node scripts/verify-ocr-pipeline.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

const { rasterizePage } = require('../dist/modules/document-analysis/extraction/ocr/ghostscript.util');
const { recognize } = require('../dist/modules/document-analysis/extraction/ocr/tesseract.util');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vdr-ocr-verify-'));
const DPI = 150;
const TIMEOUT_MS = 20000;

let failures = 0;
function check(label, condition) {
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${label}`);
  if (!condition) failures++;
}

function textPdf(outPath, pages) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    pages.forEach((text, i) => {
      if (i > 0) doc.addPage();
      doc.fontSize(16).text(text, 50, 50);
    });
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// Converts a page of a text PDF into a genuinely image-only PDF (no text
// layer) by rasterizing it to PNG then wrapping that PNG into a fresh
// PDF -- the same real transformation a scanner produces, not a simulation.
async function rasterizeToImageOnlyPdf(sourcePdf, pageNumber, outPdfPath, dpi) {
  const pngPath = path.join(TMP, `${crypto.randomUUID()}.png`);
  await rasterizePage(sourcePdf, pageNumber, dpi, pngPath, TIMEOUT_MS);
  await execFileAsync('gs', ['-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', `-o${outPdfPath}`, pngPath]);
  return pngPath;
}

async function main() {
  // --- Fixture 1: native text (no OCR should be attempted at all) ---
  const nativePdf = path.join(TMP, 'native.pdf');
  await textPdf(nativePdf, ['This is a normal, selectable text page. No OCR is needed here.']);
  check('native.pdf generated', fs.existsSync(nativePdf));

  // --- Fixture 2: scanned (image-only) ---
  const scanSourcePdf = path.join(TMP, 'scan-source.pdf');
  await textPdf(scanSourcePdf, ['The applicant filed an application for liquidation on 15 January 2026. The claim amount is Rs. 50,00,000.']);
  const scannedPdf = path.join(TMP, 'scanned.pdf');
  await rasterizeToImageOnlyPdf(scanSourcePdf, 1, scannedPdf, DPI);
  check('scanned.pdf generated (image-only, no text layer)', fs.existsSync(scannedPdf));

  const scannedPng = path.join(TMP, `${crypto.randomUUID()}.png`);
  await rasterizePage(scannedPdf, 1, DPI, scannedPng, TIMEOUT_MS);
  const scannedResult = await recognize(scannedPng, 'eng+hin', TIMEOUT_MS);
  console.log(`  recognized: "${scannedResult.text.slice(0, 80)}..." (confidence ${scannedResult.confidence.toFixed(1)})`);
  check('scanned.pdf: OCR recovers the applicant/liquidation text', /applicant|liquidation/i.test(scannedResult.text));
  check('scanned.pdf: OCR recovers the date', /2026|January/i.test(scannedResult.text));
  check('scanned.pdf: OCR recovers the amount', /50,00,000|50.00.000/.test(scannedResult.text));
  check('scanned.pdf: confidence score is a real, non-trivial number', scannedResult.confidence > 0 && scannedResult.confidence <= 100);

  // --- Fixture 3: low-resolution scan (degraded but should still mostly work) ---
  const lowResPng = path.join(TMP, `${crypto.randomUUID()}-lowres.png`);
  await rasterizePage(scanSourcePdf, 1, 72, lowResPng, TIMEOUT_MS); // half the normal DPI
  const lowResResult = await recognize(lowResPng, 'eng+hin', TIMEOUT_MS);
  console.log(`  low-res recognized: "${lowResResult.text.slice(0, 80)}..." (confidence ${lowResResult.confidence.toFixed(1)})`);
  check('low-res scan: still produces some recognized text', lowResResult.text.trim().length > 0);

  // --- Fixture 4: rotated page (sharp rotates the rasterized image) ---
  const rotatedPng = path.join(TMP, `${crypto.randomUUID()}-rotated.png`);
  await sharp(scannedPng).rotate(180).toFile(rotatedPng);
  const rotatedResult = await recognize(rotatedPng, 'eng+hin', TIMEOUT_MS);
  console.log(`  rotated (180°) recognized: "${rotatedResult.text.slice(0, 60)}..." (confidence ${rotatedResult.confidence.toFixed(1)})`);
  // A 180-degree rotation is the one orientation Tesseract's default (no
  // --psm/orientation-detection flag) cannot self-correct -- this honestly
  // records the real result rather than asserting it must succeed. A
  // production-grade fix (auto-rotation via Tesseract's OSD mode) is a
  // documented follow-up, not silently assumed to already work.
  console.log(`  (note: this pipeline does not yet auto-detect/correct page rotation -- see outstanding limitations)`);

  // --- Fixture 5: blank page ---
  const blankSourcePdf = path.join(TMP, 'blank-source.pdf');
  await textPdf(blankSourcePdf, ['']);
  const blankPng = path.join(TMP, `${crypto.randomUUID()}-blank.png`);
  await rasterizePage(blankSourcePdf, 1, DPI, blankPng, TIMEOUT_MS);
  const blankResult = await recognize(blankPng, 'eng+hin', TIMEOUT_MS);
  check('blank page: OCR completes without throwing, produces empty/near-empty text', blankResult.text.trim().length < 5);

  // --- Fixture 6: corrupted/invalid PDF (rasterization should fail cleanly, not hang) ---
  const corruptPdf = path.join(TMP, 'corrupt.pdf');
  fs.writeFileSync(corruptPdf, Buffer.from('this is not a real pdf file'));
  let corruptRejectedCleanly = false;
  try {
    await rasterizePage(corruptPdf, 1, DPI, path.join(TMP, 'corrupt-out.png'), TIMEOUT_MS);
  } catch (err) {
    corruptRejectedCleanly = err.name === 'GhostscriptError';
  }
  check('corrupt.pdf: Ghostscript rejects cleanly (GhostscriptError), does not hang or crash the process', corruptRejectedCleanly);

  // --- Fixture 7: large document (page-count handling, not full OCR of every page) ---
  const largePages = Array.from({ length: 20 }, (_, i) => `Page ${i + 1} of a large synthetic document.`);
  const largePdf = path.join(TMP, 'large.pdf');
  await textPdf(largePdf, largePages);
  const largeStart = Date.now();
  await rasterizePage(largePdf, 20, DPI, path.join(TMP, 'large-p20.png'), TIMEOUT_MS); // rasterizing only ONE page of a 20-page doc should be fast
  const largeDurationMs = Date.now() - largeStart;
  console.log(`  rasterizing page 20 of a 20-page document took ${largeDurationMs}ms`);
  check('large.pdf: rasterizing a single page (not the whole document) stays well under the OCR timeout', largeDurationMs < TIMEOUT_MS);

  // --- Fixture 8: Hindi language-pack invocation (honest scope note below) ---
  // This confirms tesseract-ocr-data-hin is installed and the `-l eng+hin`
  // invocation itself succeeds -- it does NOT prove Devanagari-script
  // recognition accuracy, since generating a fixture with genuine
  // Devanagari glyphs needs a bundled Unicode font this script does not
  // have available. That accuracy check is an outstanding item for the
  // live pilot against a real bilingual document, not claimed here.
  let hindiInvocationSucceeded = false;
  try {
    await recognize(scannedPng, 'eng+hin', TIMEOUT_MS);
    hindiInvocationSucceeded = true;
  } catch {
    hindiInvocationSucceeded = false;
  }
  check('tesseract-ocr-data-hin: the eng+hin language pack loads and runs without error (script accuracy not verified here)', hindiInvocationSucceeded);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  console.log(`\nTemp fixtures were written to: ${TMP} (not auto-deleted -- inspect or remove manually)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
