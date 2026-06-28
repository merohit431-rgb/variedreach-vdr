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

export const FILE_TYPE_RULES: FileTypeRule[] = [
  { category: 'Documents', extensions: ['pdf'], maxSizeBytes: 100 * MB },
  { category: 'Documents', extensions: ['doc', 'docx', 'odt'], maxSizeBytes: 100 * MB },
  { category: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv', 'ods'], maxSizeBytes: 50 * MB },
  { category: 'Presentations', extensions: ['ppt', 'pptx', 'odp'], maxSizeBytes: 100 * MB },
  { category: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'webp'], maxSizeBytes: 20 * MB },
  { category: 'Others', extensions: ['txt'], maxSizeBytes: 10 * MB },
  { category: 'Others', extensions: ['msg', 'eml'], maxSizeBytes: 10 * MB },
];

export function getFileTypeRule(extension: string): FileTypeRule | undefined {
  const normalized = extension.toLowerCase().replace(/^\./, '');
  return FILE_TYPE_RULES.find((rule) => rule.extensions.includes(normalized));
}
