import { renderEmailHtml, renderEmailText } from './layout';

export type StorageWarningLevel = 'WARNING' | 'CRITICAL' | 'FULL';

export interface StorageWarningParams {
  level: StorageWarningLevel;
  dataRoomName: string;
  percentUsed: number;
  manageUrl: string;
}

const COPY: Record<StorageWarningLevel, { subjectWord: string; headline: string }> = {
  WARNING: { subjectWord: 'is at 80% storage', headline: 'is approaching its storage limit' },
  CRITICAL: { subjectWord: 'is at 95% storage', headline: 'is nearly out of storage' },
  FULL: { subjectWord: 'has reached its storage limit', headline: 'has reached its storage limit' },
};

// Covers all three storage thresholds (80/95/100) -- they differ only in
// wording/urgency, not structure, so one parameterized template covers all
// three rather than three near-duplicate files.
export function storageWarningTemplate(params: StorageWarningParams): { subject: string; html: string; text: string } {
  const { level, dataRoomName, percentUsed, manageUrl } = params;
  const copy = COPY[level];
  const subject = `"${dataRoomName}" ${copy.subjectWord}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">The data room <strong>${dataRoomName}</strong> ${copy.headline} (${percentUsed}% used).</p>
    <p style="margin: 0 0 16px 0;">Consider archiving old files or removing files that are no longer needed.</p>
  `;
  const bodyText = `The data room "${dataRoomName}" ${copy.headline} (${percentUsed}% used).\n\nConsider archiving old files or removing files that are no longer needed.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml, ctaLabel: 'Manage Data Room', ctaUrl: manageUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Manage data room', ctaUrl: manageUrl }),
  };
}
