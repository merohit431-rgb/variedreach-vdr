import { Injectable, NotFoundException } from '@nestjs/common';
import { Folder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

type Grantee = { userId: string } | { groupId: string };

// Management surface for FolderAccessGrant rows -- deliberately room-manager
// tier only (assertRoomManager), the same tier that already manages members
// and security settings. Granting/revoking never touches
// DataRoomMember.canDownloadOriginal or any role field -- folder access and
// original-download permission are fully separate authorization checks, by
// construction (neither method here reads or writes that column).
//
// Phase 3A.1: grants to a Group (not just a User) are handled by this exact
// same service/table -- see FolderAccessGrant's schema comment. Nothing in
// the nearest-grant-boundary walk (FolderAccessService) changed; only the
// management surface here grew a second grantee shape.
@Injectable()
export class FolderPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listAccess(dataRoomId: string, folderId: string, actor: AuthenticatedUser, clientIp?: string) {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);
    const folder = await this.getFolderOrThrow(dataRoomId, folderId);

    const grants = await this.prisma.folderAccessGrant.findMany({
      where: { folderId, revokedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { grantedAt: 'asc' },
    });

    const explicitGrants = grants.map((g) =>
      g.user
        ? { type: 'user' as const, userId: g.user.id, name: `${g.user.firstName} ${g.user.lastName}`, email: g.user.email, grantedAt: g.grantedAt, grantedBy: g.grantedBy }
        : { type: 'group' as const, groupId: g.group!.id, name: g.group!.name, grantedAt: g.grantedAt, grantedBy: g.grantedBy },
    );

    // "View effective permissions" / "understand inherited permissions": if
    // this folder has no grants of its own (user OR group), show where
    // access would actually come from -- the nearest ancestor that itself
    // has any live grants -- so an admin can tell "inherits from X" apart
    // from "nobody (except managers) can reach this at all right now".
    const effectiveSource =
      explicitGrants.length > 0 ? ({ type: 'own' } as const) : await this.findNearestBoundary(folder);

    return { folderId, folderName: folder.name, explicitGrants, effectiveSource };
  }

  async grant(dataRoomId: string, folderId: string, grantee: Grantee, actor: AuthenticatedUser, clientIp?: string) {
    const { dataRoom } = await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);
    const folder = await this.getFolderOrThrow(dataRoomId, folderId);

    if ('userId' in grantee) {
      const membership = await this.prisma.dataRoomMember.findUnique({
        where: { dataRoomId_userId: { dataRoomId, userId: grantee.userId } },
      });
      if (!membership || membership.removedAt) {
        throw new NotFoundException('Member not found in this data room');
      }

      const existing = await this.prisma.folderAccessGrant.findUnique({
        where: { folderId_userId: { folderId, userId: grantee.userId } },
      });
      if (existing && !existing.revokedAt) return existing; // idempotent

      const grant = await this.prisma.folderAccessGrant.upsert({
        where: { folderId_userId: { folderId, userId: grantee.userId } },
        update: { revokedAt: null, revokedBy: null, grantedBy: actor.id, grantedAt: new Date() },
        create: { folderId, userId: grantee.userId, grantedBy: actor.id },
      });

      await this.auditLogService.record({
        action: 'FOLDER_ACCESS_GRANTED',
        dataRoomId,
        userId: actor.id,
        resourceType: 'Folder',
        resourceId: folderId,
        metadata: { granteeType: 'user', targetUserId: grantee.userId, folderName: folder.name },
      });

      return grant;
    }

    // Group grant: the group must belong to the SAME organisation as this
    // Data Room -- the cross-tenant guard for group-based access (without
    // this, nothing would stop granting a folder to another organisation's
    // group id).
    const group = await this.prisma.group.findFirst({
      where: { id: grantee.groupId, organisationId: dataRoom.organisationId },
    });
    if (!group) {
      throw new NotFoundException('Group not found in this organisation');
    }

    const existing = await this.prisma.folderAccessGrant.findUnique({
      where: { folderId_groupId: { folderId, groupId: grantee.groupId } },
    });
    if (existing && !existing.revokedAt) return existing; // idempotent

    const grant = await this.prisma.folderAccessGrant.upsert({
      where: { folderId_groupId: { folderId, groupId: grantee.groupId } },
      update: { revokedAt: null, revokedBy: null, grantedBy: actor.id, grantedAt: new Date() },
      create: { folderId, groupId: grantee.groupId, grantedBy: actor.id },
    });

    await this.auditLogService.record({
      action: 'FOLDER_ACCESS_GRANTED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folderId,
      metadata: { granteeType: 'group', targetGroupId: grantee.groupId, groupName: group.name, folderName: folder.name },
    });

    return grant;
  }

  async revoke(dataRoomId: string, folderId: string, grantee: Grantee, actor: AuthenticatedUser, clientIp?: string) {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);
    const folder = await this.getFolderOrThrow(dataRoomId, folderId);

    if ('userId' in grantee) {
      const existing = await this.prisma.folderAccessGrant.findUnique({
        where: { folderId_userId: { folderId, userId: grantee.userId } },
      });
      if (!existing || existing.revokedAt) {
        throw new NotFoundException('No active folder access grant found for this user on this folder');
      }

      await this.prisma.folderAccessGrant.update({
        where: { folderId_userId: { folderId, userId: grantee.userId } },
        data: { revokedAt: new Date(), revokedBy: actor.id },
      });

      await this.auditLogService.record({
        action: 'FOLDER_ACCESS_REVOKED',
        dataRoomId,
        userId: actor.id,
        resourceType: 'Folder',
        resourceId: folderId,
        metadata: { granteeType: 'user', targetUserId: grantee.userId, folderName: folder.name },
      });
      return;
    }

    const existing = await this.prisma.folderAccessGrant.findUnique({
      where: { folderId_groupId: { folderId, groupId: grantee.groupId } },
    });
    if (!existing || existing.revokedAt) {
      throw new NotFoundException('No active folder access grant found for this group on this folder');
    }

    await this.prisma.folderAccessGrant.update({
      where: { folderId_groupId: { folderId, groupId: grantee.groupId } },
      data: { revokedAt: new Date(), revokedBy: actor.id },
    });

    await this.auditLogService.record({
      action: 'FOLDER_ACCESS_REVOKED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folderId,
      metadata: { granteeType: 'group', targetGroupId: grantee.groupId, folderName: folder.name },
    });
  }

  private async getFolderOrThrow(dataRoomId: string, folderId: string): Promise<Folder> {
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, dataRoomId, deletedAt: null } });
    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }

  // Admin-facing, low-frequency lookup -- one query per ancestor level is
  // fine here, unlike the hot-path resolver in FolderAccessService.
  private async findNearestBoundary(
    folder: Folder,
  ): Promise<{ type: 'inherited'; folderId: string; folderName: string } | { type: 'none' }> {
    let current = folder;
    while (current.parentId) {
      const parent = await this.prisma.folder.findUnique({ where: { id: current.parentId } });
      if (!parent) break;
      const grantCount = await this.prisma.folderAccessGrant.count({
        where: { folderId: parent.id, revokedAt: null },
      });
      if (grantCount > 0) {
        return { type: 'inherited', folderId: parent.id, folderName: parent.name };
      }
      current = parent;
    }
    return { type: 'none' };
  }
}
