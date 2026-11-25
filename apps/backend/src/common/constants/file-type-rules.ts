// Server-side mirror of the PRD 3.3.1 supported file types table (also
// mirrored client-side in packages/shared for upload validation UX). Kept
// separate rather than imported from @variedreach-vdr/shared because that
// package ships raw TypeScript source with no build step — fine for
// Next.js's transpilePackages, but plain `node dist/main.js` has no
// bundler to transpile it, so requiring it at runtime fails.
export interface FileTypeRule {
  category: 'Documents' | 'Spreadsheets' | 'Presentations' | 'Images' | 'Archives' | 'CAD' | 'Others';
  extensions: string[];
  maxSizeBytes: number;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Uniform 2GB ceiling -- uploads stream straight to disk instead of
// buffering in memory (see LocalStorageProvider), so this is no longer
// constrained by container RAM the way it used to be.
const MAX_UPLOAD_SIZE = 2 * GB;

export const FILE_TYPE_RULES: FileTypeRule[] = [
  { category: 'Documents', extensions: ['pdf'], maxSizeBytes: MAX_UPLOAD_SIZE },
  { category: 'Documents', extensions: ['doc', 'docx', 'odt'], maxSizeBytes: MAX_UPLOAD_SIZE },
  // xlsm: same ZIP-based OOXML container as xlsx (magic-bytes.util.ts treats
  // them identically) -- macros are inert data to every part of this
  // pipeline (storage, conversion, watermarking never execute file content),
  // and the platform already accepts VBA-capable legacy binaries (doc/xls/
  // ppt) with no macro/malware scanning at all, so this isn't a new risk
  // category. See the Phase 2 remediation report for the full assessment.
  // xlsb: Excel Binary Workbook -- despite the name, it's the same ZIP-based
  // OOXML package as xlsx/xlsm (binary-encoded sheet data inside, not a
  // legacy OLE2 binary like xls), so it shares their magic-bytes signature.
  { category: 'Spreadsheets', extensions: ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'ods'], maxSizeBytes: MAX_UPLOAD_SIZE },
  { category: 'Presentations', extensions: ['ppt', 'pptx', 'odp'], maxSizeBytes: MAX_UPLOAD_SIZE },
  // tif and tiff are the same format under two conventional extensions --
  // both already matched the same magic-bytes signature; tif had simply
  // never been added to the allow-list itself.
  { category: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'bmp', 'webp'], maxSizeBytes: MAX_UPLOAD_SIZE },
  // Phase 3D (client-confirmed requirement). No content is ever extracted,
  // listed, or executed from these at upload/storage time -- see
  // archive.service.ts for the one, deliberately narrow exception (ZIP
  // metadata listing, read-only, with its own bomb/traversal limits).
  { category: 'Archives', extensions: ['zip', '7z', 'rar'], maxSizeBytes: MAX_UPLOAD_SIZE },
  // CAD drawings -- stored and downloadable like any other file, never
  // rendered or parsed server-side (no reliable, secure open-source preview
  // path exists for these formats). "DFX" in the original client list was
  // confirmed to mean DXF (Drawing Exchange Format), the real, standard CAD
  // interchange format -- there is no format actually called DFX.
  { category: 'CAD', extensions: ['dwg', 'dwf', 'dxf', 'dwfx'], maxSizeBytes: MAX_UPLOAD_SIZE },
  // xml/json: plain structured text, no binary signature, same low-risk
  // profile as txt/csv (no macros, nothing ever parses or executes them) --
  // added for IPO financial-data exports.
  { category: 'Others', extensions: ['txt', 'xml', 'json'], maxSizeBytes: MAX_UPLOAD_SIZE },
  { category: 'Others', extensions: ['msg', 'eml'], maxSizeBytes: MAX_UPLOAD_SIZE },
];

export function getFileTypeRule(extension: string): FileTypeRule | undefined {
  const normalized = extension.toLowerCase().replace(/^\./, '');
  return FILE_TYPE_RULES.find((rule) => rule.extensions.includes(normalized));
}

// Office formats converted to PDF (via Gotenberg/LibreOffice) before preview/
// watermarking — mirrors packages/shared's OFFICE_CONVERTIBLE_EXTENSIONS for
// the same require()-at-runtime reason as the rest of this file. csv is
// deliberately excluded: it's plain text, handled like .txt instead of a
// full document conversion.
export const OFFICE_CONVERTIBLE_EXTENSIONS = [
  'doc',
  'docx',
  'odt',
  'xls',
  'xlsx',
  'xlsm',
  'xlsb',
  'ods',
  'ppt',
  'pptx',
  'odp',
];

export function isOfficeConvertible(extension: string): boolean {
  return OFFICE_CONVERTIBLE_EXTENSIONS.includes(extension.toLowerCase().replace(/^\./, ''));
}

// Native PDFs only -- Office-convertible files are deliberately excluded for
// Phase 3B's extractive summarisation. Reusing getOrCreateConvertedPdf's
// cached conversion is a natural fast-follow, but a LibreOffice-exported
// text layer may extract differently from a native PDF and deserves its own
// validation pass before claiming parity.
export function isPdf(extension: string): boolean {
  return extension.toLowerCase().replace(/^\./, '') === 'pdf';
}

export function getPreviewFilename(name: string, extension: string): string {
  if (!isOfficeConvertible(extension)) {
    return name;
  }
  const withoutExtension = name.replace(/\.[^./\\]+$/, '');
  return `${withoutExtension}.pdf`;
}
