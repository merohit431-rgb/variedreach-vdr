import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { EXTERNAL_ROLES } from '../../common/constants/content-roles';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // External roles get no organisation-wide visibility at all (active data
  // room count, total user count, storage) — only a count of the data rooms
  // they're actually a member of. Manager-tier roles keep the original
  // org-wide payload unchanged.
  async getStats(actor: AuthenticatedUser) {
    if (EXTERNAL_ROLES.includes(actor.role)) {
      const assignedDataRooms = await this.prisma.dataRoom.count({
        where: {
          organisationId: actor.organisationId,
          deletedAt: null,
          members: { some: { userId: actor.id, removedAt: null } },
        },
      });

      return { assignedDataRooms };
    }

    const { organisationId } = actor;
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

  // External roles see only their own actions, never the organisation-wide
  // feed — same pagination shape either way, just a different `where`.
  async getRecentActivity(actor: AuthenticatedUser, query: RecentActivityQueryDto) {
    const where: Prisma.AuditLogWhereInput = EXTERNAL_ROLES.includes(actor.role)
      ? { userId: actor.id }
      : { OR: [{ user: { organisationId: actor.organisationId } }, { dataRoom: { organisationId: actor.organisationId } }] };

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
