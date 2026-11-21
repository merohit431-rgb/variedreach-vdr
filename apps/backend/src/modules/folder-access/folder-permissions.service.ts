import { Injectable, NotFoundException } from '@nestjs/common';
import { Folder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

// Management surface for FolderAccessGrant rows -- deliberately room-manager
// tier only (assertRoomManager), the same tier that already manages members
// and security settings. Granting/revoking never touches
// DataRoomMember.canDownloadOriginal or any role field -- folder access and
// original-download permission are fully separate authorization checks, by
// construction (neither method here reads or writes that column).
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
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { grantedAt: 'asc' },
    });

    const explicitGrants = grants.map((g) => ({
      userId: g.user.id,
      name: `${g.user.firstName} ${g.user.lastName}`,
      email: g.user.email,
      grantedAt: g.grantedAt,
      grantedBy: g.grantedBy,
    }));

    // "View effective permissions" / "understand inherited permissions": if
    // this folder has no grants of its own, show where access would
    // actually come from -- the nearest ancestor that itself has any live
    // grants -- so an admin can tell "inherits from X" apart from "nobody
    // (except managers) can reach this at all right now".
    const effectiveSource =
      explicitGrants.length > 0 ? ({ type: 'own' } as const) : await this.findNearestBoundary(folder);

    return { folderId, folderName: folder.name, explicitGrants, effectiveSource };
  }

  async grant(dataRoomId: string, folderId: string, userId: string, actor: AuthenticatedUser, clientIp?: string) {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);
    const folder = await this.getFolderOrThrow(dataRoomId, folderId);

    const membership = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
    });
    if (!membership || membership.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    const existing = await this.prisma.folderAccessGrant.findUnique({
      where: { folderId_userId: { folderId, userId } },
    });
    if (existing && !existing.revokedAt) {
      return existing; // already granted -- idempotent, no duplicate audit noise
    }

    const grant = await this.prisma.folderAccessGrant.upsert({
      where: { folderId_userId: { folderId, userId } },
      update: { revokedAt: null, revokedBy: null, grantedBy: actor.id, grantedAt: new Date() },
      create: { folderId, userId, grantedBy: actor.id },
    });

    await this.auditLogService.record({
      action: 'FOLDER_ACCESS_GRANTED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folderId,
      metadata: { targetUserId: userId, folderName: folder.name },
    });

    return grant;
  }

  async revoke(dataRoomId: string, folderId: string, userId: string, actor: AuthenticatedUser, clientIp?: string) {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, actor, clientIp);
    const folder = await this.getFolderOrThrow(dataRoomId, folderId);

    const existing = await this.prisma.folderAccessGrant.findUnique({
      where: { folderId_userId: { folderId, userId } },
    });
    if (!existing || existing.revokedAt) {
      throw new NotFoundException('No active folder access grant found for this user on this folder');
    }

    await this.prisma.folderAccessGrant.update({
      where: { folderId_userId: { folderId, userId } },
      data: { revokedAt: new Date(), revokedBy: actor.id },
    });

    await this.auditLogService.record({
      action: 'FOLDER_ACCESS_REVOKED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folderId,
      metadata: { targetUserId: userId, folderName: folder.name },
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
