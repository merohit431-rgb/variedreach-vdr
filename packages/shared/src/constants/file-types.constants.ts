// Mirrors the PRD 3.3.1 supported file types table. Used for client-side
// validation before upload and server-side validation on receipt.
export interface FileTypeRule {
  category: 'Documents' | 'Spreadsheets' | 'Presentations' | 'Images' | 'Archives' | 'CAD' | 'Others';
  extensions: string[];
  maxSizeBytes: number;
  previewable: boolean;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Uniform 2GB ceiling across every category -- uploads now stream straight
// to disk instead of buffering in memory (see LocalStorageProvider), so the
// limit is no longer constrained by container RAM the way it used to be.
const MAX_UPLOAD_SIZE = 2 * GB;

export const FILE_TYPE_RULES: FileTypeRule[] = [
  { category: 'Documents', extensions: ['pdf'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: true },
  { category: 'Documents', extensions: ['doc', 'docx', 'odt'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: true },
  {
    // xlsb: same ZIP-based OOXML package as xlsx/xlsm underneath (binary-
    // encoded sheet data, not a legacy OLE2 binary like xls) -- goes through
    // the same Gotenberg conversion for preview.
    category: 'Spreadsheets',
    extensions: ['xls', 'xlsx', 'xlsm', 'xlsb', 'ods'],
    maxSizeBytes: MAX_UPLOAD_SIZE,
    previewable: true,
  },
  { category: 'Spreadsheets', extensions: ['csv'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: true },
  {
    category: 'Presentations',
    extensions: ['ppt', 'pptx', 'odp'],
    maxSizeBytes: MAX_UPLOAD_SIZE,
    previewable: true,
  },
  {
    // bmp renders natively via a plain <img> in every modern browser --
    // confirmed safe to mark previewable. tif/tiff are carried over as
    // previewable: true unchanged from before this phase, but TIFF has no
    // reliable native <img> support outside Safari -- flagged explicitly in
    // the Phase 3D test matrix for real empirical verification rather than
    // assumed here; see SUPPORTED_FILE_FORMAT_TEST_MATRIX.md.
    category: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'bmp', 'webp'],
    maxSizeBytes: MAX_UPLOAD_SIZE,
    previewable: true,
  },
  // Phase 3D (client-confirmed requirement): stored/downloadable, never
  // extracted or rendered server-side except ZIP's own narrow, read-only
  // metadata-listing capability (archive.service.ts) -- not a "preview" in
  // the sense this flag means elsewhere (no iframe/image/text render path
  // handles any of these), so previewable stays false for all of them.
  { category: 'Archives', extensions: ['zip', '7z', 'rar'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: false },
  {
    // "DFX" in the original client-confirmed list was confirmed to mean DXF
    // (Drawing Exchange Format) -- there is no format actually called DFX.
    // No reliable, secure open-source rendering path exists for CAD
    // drawings; these are stored/downloaded only, never parsed.
    category: 'CAD',
    extensions: ['dwg', 'dwf', 'dxf', 'dwfx'],
    maxSizeBytes: MAX_UPLOAD_SIZE,
    previewable: false,
  },
  { category: 'Others', extensions: ['txt', 'xml', 'json'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: true },
  { category: 'Others', extensions: ['msg', 'eml'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: false },
];

// Office formats that get converted to PDF (via Gotenberg/LibreOffice) before
// preview/watermarking — everything in the Documents/Spreadsheets/Presentations
// categories except pdf itself, which is already native, and csv, which is
// plain text and handled like .txt instead of round-tripping through a full
// document conversion.
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

export const ALL_SUPPORTED_EXTENSIONS = FILE_TYPE_RULES.flatMap((rule) => rule.extensions);

export function getFileTypeRule(extension: string): FileTypeRule | undefined {
  const normalized = extension.toLowerCase().replace(/^\./, '');
  return FILE_TYPE_RULES.find((rule) => rule.extensions.includes(normalized));
}

export function isExtensionSupported(extension: string): boolean {
  return Boolean(getFileTypeRule(extension));
}

export function isPreviewable(extension: string): boolean {
  return getFileTypeRule(extension)?.previewable ?? false;
}

export function isOfficeConvertible(extension: string): boolean {
  return OFFICE_CONVERTIBLE_EXTENSIONS.includes(extension.toLowerCase().replace(/^\./, ''));
}

// Native PDFs only -- see the backend's file-type-rules.ts copy of this
// function for why Office-convertible files aren't eligible yet.
export function isPdf(extension: string): boolean {
  return extension.toLowerCase().replace(/^\./, '') === 'pdf';
}

// What a preview/download response is actually named once office-convertible
// files are served as PDF instead of their original format.
export function getPreviewFilename(name: string, extension: string): string {
  if (!isOfficeConvertible(extension)) {
    return name;
  }
  const withoutExtension = name.replace(/\.[^./\\]+$/, '');
  return `${withoutExtension}.pdf`;
}
