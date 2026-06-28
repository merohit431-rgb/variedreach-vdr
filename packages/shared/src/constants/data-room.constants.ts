// Mirrors the DataRoomType enum in apps/backend/prisma/schema.prisma.
export const DATA_ROOM_TYPES = ['CIRP', 'LIQUIDATION', 'MA_DUE_DILIGENCE', 'OTHER'] as const;

export type DataRoomType = (typeof DATA_ROOM_TYPES)[number];

export const DATA_ROOM_TYPE_LABELS: Record<DataRoomType, string> = {
  CIRP: 'CIRP',
  LIQUIDATION: 'Liquidation',
  MA_DUE_DILIGENCE: 'M&A Due Diligence',
  OTHER: 'Other',
};
