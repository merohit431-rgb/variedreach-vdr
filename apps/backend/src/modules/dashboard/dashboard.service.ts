import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { StorageUpgradeRequestDto } from './dto/storage-upgrade-request.dto';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { EXTERNAL_ROLES } from '../../common/constants/content-roles';
import { getOrgStorageUsage, computeStoragePercent } from '../../common/org-storage.util';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { ContactRequestField } from '../mail/templates/contact-request.template';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
  ) {}

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
    const [activeDataRooms, totalUsers, storage] = await Promise.all([
      this.prisma.dataRoom.count({
        where: { organisationId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.user.count({ where: { organisationId, deletedAt: null } }),
      getOrgStorageUsage(this.prisma, organisationId),
    ]);

    const usedBytes = Number(storage.usedBytes);
    const percentUsed = computeStoragePercent(storage.usedBytes, storage.limitBytes);

    return {
      activeDataRooms,
      totalUsers,
      storage: {
        usedBytes,
        usedGb: Number((usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
        limitGb: storage.limitGb,
        percentUsed,
      },
    };
  }

  // No self-service payment yet (billing/Razorpay lands in a later wave), so
  // "buy more storage" is a request: it notifies every Super Admin (in-app +
  // email) and audits the ask; Super Admin grants it via the existing
  // organisation storageLimitGb edit. Org Admin only — enforced by the
  // controller's @Roles guard.
  async requestStorageUpgrade(actor: AuthenticatedUser, dto: StorageUpgradeRequestDto) {
    const [organisation, storage, requester, superAdmins] = await Promise.all([
      this.prisma.organisation.findUniqueOrThrow({
        where: { id: actor.organisationId },
        select: { name: true, storageLimitGb: true },
      }),
      getOrgStorageUsage(this.prisma, actor.organisationId),
      this.prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
        select: { id: true },
      }),
    ]);

    if (dto.requestedGb <= organisation.storageLimitGb) {
      throw new BadRequestException(
        `Requested storage must be greater than the current ${organisation.storageLimitGb} GB plan`,
      );
    }

    const requesterName = `${requester.firstName} ${requester.lastName}`;
    const usedGb = Number((Number(storage.usedBytes) / (1024 * 1024 * 1024)).toFixed(2));
    const title = 'Storage upgrade requested';
    const message = `${organisation.name} requested an upgrade from ${organisation.storageLimitGb} GB to ${dto.requestedGb} GB.`;

    await Promise.all([
      ...superAdmins.map((admin) =>
        this.notificationService.create({
          userId: admin.id,
          type: 'STORAGE_UPGRADE_REQUESTED',
          title,
          message,
          metadata: { organisationId: actor.organisationId, currentGb: organisation.storageLimitGb, requestedGb: dto.requestedGb },
        }),
      ),
      this.auditLogService.record({
        action: 'STORAGE_UPGRADE_REQUESTED',
        userId: actor.id,
        resourceType: 'Organisation',
        resourceId: actor.organisationId,
        metadata: { currentGb: organisation.storageLimitGb, requestedGb: dto.requestedGb, note: dto.note ?? null },
      }),
      this.mailService.sendStorageUpgradeRequestEmail(
        requesterName,
        [
          { label: 'Organisation', value: organisation.name },
          { label: 'Current plan', value: `${organisation.storageLimitGb} GB (using ${usedGb} GB)` },
          { label: 'Requested', value: `${dto.requestedGb} GB` },
          ...(dto.note ? [{ label: 'Note', value: dto.note } as ContactRequestField] : []),
        ],
        requester.email,
      ),
    ]);

    return { received: true };
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
