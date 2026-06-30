// Server-side mirror of the PRD 3.3.1 supported file types table (also
// mirrored client-side in packages/shared for upload validation UX). Kept
// separate rather than imported from @variedreach-vdr/shared because that
// package ships raw TypeScript source with no build step — fine for
// Next.js's transpilePackages, but plain `node dist/main.js` has no
// bundler to transpile it, so requiring it at runtime fails.
export interface FileTypeRule {
  category: 'Documents' | 'Spreadsheets' | 'Presentations' | 'Images' | 'Others';
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
  { category: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv', 'ods'], maxSizeBytes: MAX_UPLOAD_SIZE },
  { category: 'Presentations', extensions: ['ppt', 'pptx', 'odp'], maxSizeBytes: MAX_UPLOAD_SIZE },
  { category: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'webp'], maxSizeBytes: MAX_UPLOAD_SIZE },
  { category: 'Others', extensions: ['txt'], maxSizeBytes: MAX_UPLOAD_SIZE },
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
  'ods',
  'ppt',
  'pptx',
  'odp',
];

export function isOfficeConvertible(extension: string): boolean {
  return OFFICE_CONVERTIBLE_EXTENSIONS.includes(extension.toLowerCase().replace(/^\./, ''));
}

export function getPreviewFilename(name: string, extension: string): string {
  if (!isOfficeConvertible(extension)) {
    return name;
  }
  const withoutExtension = name.replace(/\.[^./\\]+$/, '');
  return `${withoutExtension}.pdf`;
}
