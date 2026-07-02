import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { ReportQueryDto } from './dto/report-query.dto';

export interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface StorageReportTable extends ReportTable {
  summary: {
    usedBytes: string;
    limitGb: number;
    fileCount: number;
    byType: Record<string, string>;
  };
}

export interface SummaryStats {
  totalFiles: number;
  totalDownloads: number;
  totalViews: number;
  totalUploads: number;
  activeUsers: number;
  storageUsedBytes: string;
  storageLimitGb: number;
  storageUsedPercent: number;
}

export interface TrendPoint {
  date: string;
  downloads: number;
  views: number;
}

const FILE_ACTIVITY_ACTIONS = ['FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_VIEWED'] as const;

function getFileTypeCategory(ext: string): string {
  const e = (ext ?? '').toLowerCase();
  if (e === 'pdf') return 'PDF';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'].includes(e)) return 'Images';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'txt', 'rtf'].includes(e))
    return 'Documents';
  return 'Other';
}

function formatBytesServer(bytes: bigint): string {
  const n = Number(bytes);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} KB`;
  return `${n} B`;
}

function buildDateFilter(query: ReportQueryDto): Prisma.AuditLogWhereInput {
  if (!query.from && !query.to) return {};
  return {
    createdAt: {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    },
  };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSummaryStats(
    dataRoomId: string,
    actor: AuthenticatedUser,
    query: ReportQueryDto,
  ): Promise<SummaryStats> {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

    const dateFilter = buildDateFilter(query);

    const [dataRoom, downloadCount, viewCount, uploadCount, fileCount, uniqueUserRows] = await Promise.all([
      this.prisma.dataRoom.findUnique({
        where: { id: dataRoomId },
        select: { storageUsedBytes: true, storageLimitGb: true },
      }),
      this.prisma.auditLog.count({ where: { dataRoomId, action: 'FILE_DOWNLOADED', ...dateFilter } }),
      this.prisma.auditLog.count({ where: { dataRoomId, action: 'FILE_VIEWED', ...dateFilter } }),
      this.prisma.auditLog.count({ where: { dataRoomId, action: 'FILE_UPLOADED', ...dateFilter } }),
      this.prisma.file.count({ where: { dataRoomId } }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { dataRoomId, userId: { not: null }, ...dateFilter },
      }),
    ]);

    const usedBytes = dataRoom?.storageUsedBytes ?? 0n;
    const limitGb = dataRoom?.storageLimitGb ?? 1;
    const limitBytes = BigInt(limitGb) * 1024n * 1024n * 1024n;
    const usedPercent = limitBytes > 0n ? Math.round(Number((usedBytes * 100n) / limitBytes)) : 0;

    return {
      totalFiles: fileCount,
      totalDownloads: downloadCount,
      totalViews: viewCount,
      totalUploads: uploadCount,
      activeUsers: uniqueUserRows.length,
      storageUsedBytes: usedBytes.toString(),
      storageLimitGb: limitGb,
      storageUsedPercent: usedPercent,
    };
  }

  async getDownloadTrends(
    dataRoomId: string,
    actor: AuthenticatedUser,
    query: ReportQueryDto,
  ): Promise<TrendPoint[]> {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const from = query.from ? new Date(query.from) : defaultFrom;
    const to = query.to ? new Date(query.to) : new Date();

    const entries = await this.prisma.auditLog.findMany({
      where: {
        dataRoomId,
        action: { in: ['FILE_DOWNLOADED', 'FILE_VIEWED'] },
        createdAt: { gte: from, lte: to },
      },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate = new Map<string, { downloads: number; views: number }>();
    for (const entry of entries) {
      const date = entry.createdAt.toISOString().slice(0, 10);
      const existing = byDate.get(date) ?? { downloads: 0, views: 0 };
      if (entry.action === 'FILE_DOWNLOADED') existing.downloads++;
      else existing.views++;
      byDate.set(date, existing);
    }

    return Array.from(byDate.entries()).map(([date, counts]) => ({ date, ...counts }));
  }

  async getStorageReport(dataRoomId: string, actor: AuthenticatedUser): Promise<StorageReportTable> {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

    const [dataRoom, files] = await Promise.all([
      this.prisma.dataRoom.findUnique({
        where: { id: dataRoomId },
        select: { storageUsedBytes: true, storageLimitGb: true },
      }),
      this.prisma.file.findMany({
        where: { dataRoomId },
        select: { name: true, extension: true, sizeBytes: true, createdAt: true },
        orderBy: { sizeBytes: 'desc' },
        take: 100,
      }),
    ]);

    const usedBytes = dataRoom?.storageUsedBytes ?? 0n;
    const limitGb = dataRoom?.storageLimitGb ?? 1;
    const limitBytes = BigInt(limitGb) * 1024n * 1024n * 1024n;

    const byType: Record<string, bigint> = {};
    for (const file of files) {
      const cat = getFileTypeCategory(file.extension);
      byType[cat] = (byType[cat] ?? 0n) + file.sizeBytes;
    }

    const rows: (string | number)[][] = files.map((file) => {
      const pct =
        limitBytes > 0n ? ((Number(file.sizeBytes) / Number(limitBytes)) * 100).toFixed(2) : '0.00';
      return [
        file.name,
        file.extension || 'unknown',
        formatBytesServer(file.sizeBytes),
        `${pct}%`,
        file.createdAt.toISOString().slice(0, 10),
      ];
    });

    return {
      title: 'Storage Report',
      headers: ['File Name', 'Type', 'Size', '% of Quota', 'Uploaded'],
      rows,
      summary: {
        usedBytes: usedBytes.toString(),
        limitGb,
        fileCount: files.length,
        byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.toString()])),
      },
    };
  }

  async getDownloadActivityReport(
    dataRoomId: string,
    actor: AuthenticatedUser,
    query: ReportQueryDto,
  ): Promise<ReportTable> {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

    const where: Prisma.AuditLogWhereInput = {
      dataRoomId,
      action: 'FILE_DOWNLOADED',
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const entries = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        watermark: { select: { watermarkId: true } },
      },
    });

    const rows = entries.map((entry) => {
      const fileName =
        entry.metadata && typeof (entry.metadata as Record<string, unknown>).name === 'string'
          ? (entry.metadata as Record<string, string>).name
          : 'Unknown';

      return [
        entry.createdAt.toISOString(),
        entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
        entry.user?.email ?? '—',
        fileName,
        entry.watermark?.watermarkId ?? '—',
        entry.ipAddress ?? '—',
      ];
    });

    return {
      title: 'Download Activity Report',
      headers: ['Timestamp', 'User', 'Email', 'File', 'Watermark ID', 'IP Address'],
      rows,
    };
  }

  async getUserActivityReport(dataRoomId: string, actor: AuthenticatedUser): Promise<ReportTable> {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor);

    const [members, totalCounts, actionCounts, lastActivity] = await Promise.all([
      this.prisma.dataRoomMember.findMany({
        where: { dataRoomId, removedAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { dataRoomId, userId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId', 'action'],
        where: { dataRoomId, userId: { not: null }, action: { in: [...FILE_ACTIVITY_ACTIONS] } },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { dataRoomId, userId: { not: null } },
        _max: { createdAt: true },
      }),
    ]);

    const totalByUser = new Map(totalCounts.map((row) => [row.userId, row._count._all]));
    const lastActiveByUser = new Map(lastActivity.map((row) => [row.userId, row._max.createdAt]));
    const breakdownByUser = new Map<string, Record<string, number>>();

    for (const row of actionCounts) {
      if (!row.userId) continue;
      const existing = breakdownByUser.get(row.userId) ?? {};
      existing[row.action] = row._count._all;
      breakdownByUser.set(row.userId, existing);
    }

    const rows = members.map((member) => {
      const breakdown = breakdownByUser.get(member.userId) ?? {};
      const lastActive = lastActiveByUser.get(member.userId);

      return [
        `${member.user.firstName} ${member.user.lastName}`,
        member.user.email,
        member.roleOverride ?? member.user.role,
        breakdown.FILE_UPLOADED ?? 0,
        breakdown.FILE_DOWNLOADED ?? 0,
        breakdown.FILE_VIEWED ?? 0,
        totalByUser.get(member.userId) ?? 0,
        lastActive ? lastActive.toISOString() : 'Never',
      ];
    });

    return {
      title: 'User Activity Report',
      headers: [
        'Name',
        'Email',
        'Role',
        'Files Uploaded',
        'Files Downloaded',
        'Files Viewed',
        'Total Actions',
        'Last Active',
      ],
      rows,
    };
  }

  async recordExport(dataRoomId: string, reportName: string, format: string, actor: AuthenticatedUser) {
    await this.auditLogService.record({
      action: 'REPORT_EXPORTED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Report',
      metadata: { reportName, format },
    });
  }
}
