import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CONTENT_MANAGER_ROLES } from '../../common/constants/content-roles';

// Org-wide roles that can act on any data room in their organisation without
// an explicit DataRoomMember row (mirrors DataRoomsService's ADMIN_ROLES).
const ORG_WIDE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

@Injectable()
export class DataRoomAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Loads the data room (scoped to the actor's org) and the actor's effective
  // role within it, or throws. Returns null role for org-wide admins who
  // aren't an explicit member — callers should treat that as "full access".
  async getAccess(dataRoomId: string, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, organisationId: actor.organisationId, deletedAt: null },
    });

    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }

    if (ORG_WIDE_ROLES.includes(actor.role)) {
      return { dataRoom, effectiveRole: actor.role, isMember: true };
    }

    const membership = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
    });

    if (!membership || membership.removedAt) {
      throw new ForbiddenException('You do not have access to this data room');
    }

    return {
      dataRoom,
      effectiveRole: membership.roleOverride ?? actor.role,
      isMember: true,
    };
  }

  async assertContentManager(dataRoomId: string, actor: AuthenticatedUser) {
    const access = await this.getAccess(dataRoomId, actor);

    if (!CONTENT_MANAGER_ROLES.includes(access.effectiveRole)) {
      throw new ForbiddenException('Your role does not allow managing content in this data room');
    }

    return access;
  }
}
