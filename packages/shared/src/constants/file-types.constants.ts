// Mirrors the PRD 3.3.1 supported file types table. Used for client-side
// validation before upload and server-side validation on receipt.
export interface FileTypeRule {
  category: 'Documents' | 'Spreadsheets' | 'Presentations' | 'Images' | 'Others';
  extensions: string[];
  maxSizeBytes: number;
  previewable: boolean;
}

const MB = 1024 * 1024;

export const FILE_TYPE_RULES: FileTypeRule[] = [
  { category: 'Documents', extensions: ['pdf'], maxSizeBytes: 100 * MB, previewable: true },
  { category: 'Documents', extensions: ['doc', 'docx', 'odt'], maxSizeBytes: 100 * MB, previewable: false },
  {
    category: 'Spreadsheets',
    extensions: ['xls', 'xlsx', 'csv', 'ods'],
    maxSizeBytes: 50 * MB,
    previewable: false,
  },
  {
    category: 'Presentations',
    extensions: ['ppt', 'pptx', 'odp'],
    maxSizeBytes: 100 * MB,
    previewable: false,
  },
  {
    category: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'webp'],
    maxSizeBytes: 20 * MB,
    previewable: true,
  },
  { category: 'Others', extensions: ['txt'], maxSizeBytes: 10 * MB, previewable: true },
  { category: 'Others', extensions: ['msg', 'eml'], maxSizeBytes: 10 * MB, previewable: false },
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
