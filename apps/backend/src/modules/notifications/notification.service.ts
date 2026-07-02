import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  dataRoomId?: string;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({ data: input });
  }

  async createForRoomManagers(
    dataRoomId: string,
    input: Omit<CreateNotificationInput, 'userId'>,
    excludeUserId?: string,
  ) {
    const MANAGER_ROLES = ['ORG_ADMIN', 'RP_LIQUIDATOR', 'SUPER_ADMIN'];
    const members = await this.prisma.dataRoomMember.findMany({
      where: { dataRoomId, removedAt: null },
      include: { user: { select: { id: true, role: true } } },
    });

    const managerUserIds = members
      .filter((m) => {
        const effectiveRole = m.roleOverride ?? m.user.role;
        return MANAGER_ROLES.includes(effectiveRole as string);
      })
      .map((m) => m.userId)
      .filter((id) => id !== excludeUserId);

    if (managerUserIds.length === 0) return;

    await this.prisma.notification.createMany({
      data: managerUserIds.map((userId) => ({ ...input, userId, dataRoomId })),
    });
  }

  async list(actor: AuthenticatedUser) {
    return this.prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(actor: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: actor.id, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, actor: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { id, userId: actor.id },
      data: { isRead: true },
    });
  }

  async markAllRead(actor: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.id, isRead: false },
      data: { isRead: true },
    });
  }
}
