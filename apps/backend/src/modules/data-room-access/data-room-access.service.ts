import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as ipaddr from 'ipaddr.js';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import {
  CONTENT_DELETE_ROLES,
  CONTENT_MANAGER_ROLES,
  DATA_ROOM_MANAGER_ROLES,
  NO_DOWNLOAD_ROLES,
} from '../../common/constants/content-roles';

// Org-wide roles that can act on any data room in their organisation without
// an explicit DataRoomMember row (mirrors DataRoomsService's ADMIN_ROLES).
const ORG_WIDE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

@Injectable()
export class DataRoomAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Loads the data room (scoped to the actor's org) and the actor's effective
  // role within it, or throws. Returns null role for org-wide admins who
  // aren't an explicit member — callers should treat that as "full access".
  async getAccess(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, organisationId: actor.organisationId, deletedAt: null },
    });

    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }

    const isOrgWide = ORG_WIDE_ROLES.includes(actor.role);

    // IP allowlist check — SUPER_ADMIN/ORG_ADMIN bypass so admins never lock
    // themselves out when misconfiguring the list.
    if (dataRoom.ipAllowlistEnabled && !isOrgWide && clientIp) {
      this.assertIpAllowed(clientIp, dataRoom.allowedIps);
    }

    if (isOrgWide) {
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

  async assertContentManager(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const access = await this.getAccess(dataRoomId, actor, clientIp);

    if (!CONTENT_MANAGER_ROLES.includes(access.effectiveRole)) {
      throw new ForbiddenException('Your role does not allow managing content in this data room');
    }

    return access;
  }

  async assertContentDeleter(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const access = await this.getAccess(dataRoomId, actor, clientIp);

    if (!CONTENT_DELETE_ROLES.includes(access.effectiveRole)) {
      throw new ForbiddenException('Your role does not allow deleting content in this data room');
    }

    return access;
  }

  async assertCanDownload(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const access = await this.getAccess(dataRoomId, actor, clientIp);

    if (NO_DOWNLOAD_ROLES.includes(access.effectiveRole)) {
      throw new ForbiddenException('Your role is view-only and cannot download documents');
    }

    return access;
  }

  async assertRoomManager(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const access = await this.getAccess(dataRoomId, actor, clientIp);

    if (!DATA_ROOM_MANAGER_ROLES.includes(access.effectiveRole)) {
      throw new ForbiddenException('Your role does not allow this action in this data room');
    }

    return access;
  }

  // Checks whether ip falls within any of the allowedCidrs.
  // An empty allowedCidrs list is treated as "allow all" (misconfiguration safety).
  private assertIpAllowed(ip: string, allowedCidrs: string[]): void {
    if (allowedCidrs.length === 0) return;

    try {
      const parsed = ipaddr.process(ip);
      const allowed = allowedCidrs.some((cidr) => {
        try {
          const range = ipaddr.parseCIDR(cidr);
          // ipaddr.js types don't unify IPv4/IPv6 match signatures — cast to avoid TS2349
          return (parsed as { match: (r: unknown) => boolean }).match(range);
        } catch {
          return false;
        }
      });

      if (!allowed) {
        throw new ForbiddenException('Access to this data room is restricted to specific IP addresses');
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // If we can't parse the client IP, deny access to be safe
      throw new ForbiddenException('Access to this data room is restricted to specific IP addresses');
    }
  }
}
