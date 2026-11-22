#!/usr/bin/env node
// Standalone, manually-run verification of the REAL pdfjs-dist library
// against real PDF fixtures -- run under plain Node, outside Jest.
//
// Why this exists outside the test suite: pdfjs-dist is a true ESM-only
// package, and its dynamic import cannot execute inside Jest's CommonJS
// test environment without invasive, shared-config changes that would risk
// every other test in this suite (confirmed empirically, not assumed --
// see the Phase 3B implementation notes). pdf-extraction.adapter.spec.ts
// mocks this library to test the adapter's OWN logic; this script is what
// actually proves the real library behaves as documented against real
// fixtures. Re-run after ever bumping the pinned pdfjs-dist version.
//
// Usage: node scripts/verify-pdf-extraction.js

const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '../src/modules/document-analysis/extraction/__fixtures__');

async function extractText(pdfPath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = `${path.join(pdfjsRoot, 'standard_fonts')}/`;
  const cMapUrl = `${path.join(pdfjsRoot, 'cmaps')}/`;

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, standardFontDataUrl, cMapUrl, cMapPacked: true, useSystemFonts: false })
    .promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages;
}

let failures = 0;
function check(label, condition) {
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${label}`);
  if (!condition) failures++;
}

async function main() {
  const normalPages = await extractText(`${FIXTURES}/normal.pdf`);
  check('normal.pdf: 2 pages extracted', normalPages.length === 2);
  check(
    'normal.pdf: page 1 text is exact',
    normalPages[0].includes('ABC Limited filed an application before the Adjudicating Authority on 15 January 2026.'),
  );
  check('normal.pdf: abbreviation-heavy text preserved verbatim', normalPages[0].includes('M/s. Sharma & Associates'));

  let encryptedDetected = false;
  try {
    await extractText(`${FIXTURES}/encrypted.pdf`);
  } catch (err) {
    encryptedDetected = err.name === 'PasswordException';
  }
  check('encrypted.pdf: PasswordException thrown', encryptedDetected);

  const emptyPages = await extractText(`${FIXTURES}/empty.pdf`);
  check('empty.pdf: extracts with no meaningful text', emptyPages[0].trim().length < 20);

  let malformedRejected = false;
  try {
    await extractText(`${FIXTURES}/malformed.pdf`);
  } catch {
    malformedRejected = true;
  }
  check('malformed.pdf: load rejects rather than crashing the process', malformedRejected);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
