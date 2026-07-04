// Mirrors the PRD 3.3.1 supported file types table. Used for client-side
// validation before upload and server-side validation on receipt.
export interface FileTypeRule {
  category: 'Documents' | 'Spreadsheets' | 'Presentations' | 'Images' | 'Others';
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
    category: 'Spreadsheets',
    extensions: ['xls', 'xlsx', 'ods'],
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
    category: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'webp'],
    maxSizeBytes: MAX_UPLOAD_SIZE,
    previewable: true,
  },
  { category: 'Others', extensions: ['txt'], maxSizeBytes: MAX_UPLOAD_SIZE, previewable: true },
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

// What a preview/download response is actually named once office-convertible
// files are served as PDF instead of their original format.
export function getPreviewFilename(name: string, extension: string): string {
  if (!isOfficeConvertible(extension)) {
    return name;
  }
  const withoutExtension = name.replace(/\.[^./\\]+$/, '');
  return `${withoutExtension}.pdf`;
}
