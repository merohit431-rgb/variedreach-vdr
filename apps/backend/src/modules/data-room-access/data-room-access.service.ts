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
  // This is the full content-access gate (adds the NDA check on top of
  // assertMembership()) -- every content/room endpoint routes through here
  // via assertContentManager/assertContentDeleter/assertCanDownload/
  // assertCanDownloadOriginal/assertRoomManager. The NDA acceptance flow
  // itself must NOT use this method -- see assertMembership()'s comment.
  async getAccess(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const access = await this.assertMembership(dataRoomId, actor, clientIp);

    // NDA gate. Manager-tier roles are the room's own internal staff, not
    // external reviewers under confidentiality obligations, so they bypass it.
    if (access.dataRoom.ndaEnabled && !DATA_ROOM_MANAGER_ROLES.includes(access.effectiveRole)) {
      const acceptance = await this.prisma.ndaAcceptance.findUnique({
        where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
      });

      if (!acceptance) {
        throw new ForbiddenException(
          'You must accept the confidentiality agreement before accessing this data room',
        );
      }
    }

    return access;
  }

  // Resolves data-room membership, the IP allowlist and the actor's effective
  // role -- everything getAccess() does EXCEPT the NDA gate. Split out so the
  // NDA acceptance flow itself (NdaService.getStatus/accept) can resolve "is
  // this actor even a member of this room" without going through the NDA
  // check it exists to satisfy. getAccess() calling itself from there was a
  // real, shipped bug: no member could ever accept a room's NDA, because the
  // accept endpoint required the NDA to already be accepted. Every other
  // caller (actual content access) should keep using getAccess() or one of
  // its assert* wrappers below -- this method intentionally does not gate on
  // NDA at all, so it must never be used to authorize reading file/folder
  // content.
  async assertMembership(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
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

    let effectiveRole: UserRole;
    // Deliberately NOT folded into isOrgWide's implicit "full access" --
    // this is a dedicated, explicitly-granted permission (unwatermarked
    // original download), not something org-wide admin status should confer
    // automatically. Only SUPER_ADMIN (platform operator, a different trust
    // tier than any organisation role) bypasses; ORG_ADMIN needs the same
    // explicit DataRoomMember.canDownloadOriginal flag as everyone else.
    let canDownloadOriginal = actor.role === UserRole.SUPER_ADMIN;

    if (isOrgWide) {
      effectiveRole = actor.role;
      if (!canDownloadOriginal) {
        const membership = await this.prisma.dataRoomMember.findUnique({
          where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
        });
        canDownloadOriginal = membership?.canDownloadOriginal ?? false;
      }
    } else {
      const membership = await this.prisma.dataRoomMember.findUnique({
        where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
      });

      if (!membership || membership.removedAt) {
        throw new ForbiddenException('You do not have access to this data room');
      }

      effectiveRole = membership.roleOverride ?? actor.role;
      canDownloadOriginal = membership.canDownloadOriginal;
    }

    return { dataRoom, effectiveRole, isMember: true, canDownloadOriginal };
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

  // The dedicated DOWNLOAD_ORIGINAL permission -- deliberately a separate
  // assertion from assertCanDownload rather than a parameter on it, so every
  // call site has to explicitly choose which one it means.
  async assertCanDownloadOriginal(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const access = await this.getAccess(dataRoomId, actor, clientIp);

    if (!access.canDownloadOriginal) {
      throw new ForbiddenException('You do not have permission to download the original, unwatermarked file');
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
