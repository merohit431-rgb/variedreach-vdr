// Mirrors the DataRoomType enum in apps/backend/prisma/schema.prisma.
export const DATA_ROOM_TYPES = ['CIRP', 'LIQUIDATION', 'MA_DUE_DILIGENCE', 'OTHER'] as const;

export type DataRoomType = (typeof DATA_ROOM_TYPES)[number];

export const DATA_ROOM_TYPE_LABELS: Record<DataRoomType, string> = {
  CIRP: 'CIRP',
  LIQUIDATION: 'Liquidation',
  MA_DUE_DILIGENCE: 'M&A Due Diligence',
  OTHER: 'Other',
};

// Mirrors the DownloadPolicy enum in apps/backend/prisma/schema.prisma.
export const DOWNLOAD_POLICIES = ['PREVIEW_ONLY', 'ORIGINAL_ONLY', 'WATERMARKED_ONLY', 'BOTH'] as const;

export type DownloadPolicy = (typeof DOWNLOAD_POLICIES)[number];

export const DOWNLOAD_POLICY_LABELS: Record<DownloadPolicy, string> = {
  PREVIEW_ONLY: 'Preview Only (No Downloads)',
  ORIGINAL_ONLY: 'Download Original Files Only',
  WATERMARKED_ONLY: 'Download Watermarked PDF Only',
  BOTH: 'Allow Both Original Files and Watermarked PDF Downloads',
};

// Secondary helper text shown under each option in the Security Settings
// form, so an admin understands the consequence, not just the label.
export const DOWNLOAD_POLICY_DESCRIPTIONS: Record<DownloadPolicy, string> = {
  PREVIEW_ONLY: 'Users can view documents in-browser but cannot download any file, in any format.',
  ORIGINAL_ONLY:
    'Users with download permission receive the unwatermarked original file. External roles (PRA, CoC Member, Auditor, Legal Advisor, Guest) cannot download in this mode.',
  WATERMARKED_ONLY:
    'Users with download permission receive a watermarked PDF copy. This is the default and matches existing behavior.',
  BOTH: 'Users with download permission choose between the original file and a watermarked PDF. External roles are still limited to the watermarked copy.',
};
