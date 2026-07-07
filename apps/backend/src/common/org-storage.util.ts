import { PrismaService } from '../prisma/prisma.service';

export interface OrgStorageUsage {
  usedBytes: bigint;
  limitGb: number;
  limitBytes: bigint;
}

// Organisation-wide storage is the sum of storageUsedBytes across all its
// (non-deleted) data rooms — there is no denormalised org-level counter, so
// this is computed on read. Shared by the dashboard stat widget and the
// upload pre-flight guard so both agree on the same number.
export async function getOrgStorageUsage(prisma: PrismaService, organisationId: string): Promise<OrgStorageUsage> {
  const [organisation, agg] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: organisationId }, select: { storageLimitGb: true } }),
    prisma.dataRoom.aggregate({
      where: { organisationId, deletedAt: null },
      _sum: { storageUsedBytes: true },
    }),
  ]);

  const limitGb = organisation?.storageLimitGb ?? 0;
  return {
    usedBytes: agg._sum.storageUsedBytes ?? 0n,
    limitGb,
    limitBytes: BigInt(limitGb) * 1024n * 1024n * 1024n,
  };
}

export function computeStoragePercent(usedBytes: bigint, limitBytes: bigint): number {
  if (limitBytes <= 0n) return 0;
  // Rounds to the nearest percent (not truncated) — done in floating point
  // since these values are well within Number's safe range at real-world
  // storage sizes (petabytes before precision loss becomes a concern).
  return Math.min(100, Math.round((Number(usedBytes) / Number(limitBytes)) * 100));
}
