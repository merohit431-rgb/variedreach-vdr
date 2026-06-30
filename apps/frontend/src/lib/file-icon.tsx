import { FileText, FileSpreadsheet, Presentation, Image as ImageIcon, File as FileIcon, LucideIcon } from 'lucide-react';
import { getFileTypeRule } from '@variedreach-vdr/shared';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Documents: FileText,
  Spreadsheets: FileSpreadsheet,
  Presentations: Presentation,
  Images: ImageIcon,
  Others: FileIcon,
};

export function getFileIcon(extension: string): LucideIcon {
  const rule = getFileTypeRule(extension);
  return (rule && CATEGORY_ICONS[rule.category]) || FileIcon;
}
