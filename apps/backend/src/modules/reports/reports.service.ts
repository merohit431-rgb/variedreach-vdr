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

const FILE_ACTIVITY_ACTIONS = ['FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_VIEWED'] as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly auditLogService: AuditLogService,
  ) {}

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
