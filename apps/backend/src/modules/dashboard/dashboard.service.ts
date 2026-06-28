import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(organisationId: string) {
    const [activeDataRooms, totalUsers, organisation, dataRooms] = await Promise.all([
      this.prisma.dataRoom.count({
        where: { organisationId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.user.count({ where: { organisationId, deletedAt: null } }),
      this.prisma.organisation.findUnique({ where: { id: organisationId } }),
      this.prisma.dataRoom.findMany({
        where: { organisationId, deletedAt: null },
        select: { storageUsedBytes: true },
      }),
    ]);

    const usedBytes = dataRooms.reduce((sum, room) => sum + Number(room.storageUsedBytes), 0);
    const limitGb = organisation?.storageLimitGb ?? 0;
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const percentUsed = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;

    return {
      activeDataRooms,
      totalUsers,
      storage: {
        usedBytes,
        usedGb: Number((usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
        limitGb,
        percentUsed,
      },
    };
  }

  async getRecentActivity(organisationId: string, query: RecentActivityQueryDto) {
    const where = {
      OR: [{ user: { organisationId } }, { dataRoom: { organisationId } }],
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          dataRoom: { select: { name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
