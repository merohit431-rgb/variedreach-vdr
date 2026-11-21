import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FolderPermissionsService } from './folder-permissions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const FOLDER = { id: 'folder-1', name: 'Tax Documents', parentId: null, dataRoomId: 'room-1', deletedAt: null };
const MANAGER = { id: 'manager-1', organisationId: 'org-1', role: 'RP_LIQUIDATOR' } as AuthenticatedUser;

function buildService(opts: {
  assertRoomManager?: jest.Mock;
  folder?: unknown;
  membership?: unknown;
  existingGrant?: unknown;
  grants?: unknown[];
}) {
  // 'key' in opts (not ??) throughout -- null is a deliberate test value for
  // folder/membership/existingGrant (missing folder, non-member, no grant),
  // and ?? would treat it as "unset" and silently fall through to the
  // default, defeating every 404 test below.
  const assertRoomManager = opts.assertRoomManager ?? jest.fn().mockResolvedValue({ effectiveRole: 'RP_LIQUIDATOR' });
  const folderFindFirst = jest.fn().mockResolvedValue('folder' in opts ? opts.folder : FOLDER);
  const memberFindUnique = jest.fn().mockResolvedValue('membership' in opts ? opts.membership : { removedAt: null });
  const grantFindUnique = jest.fn().mockResolvedValue('existingGrant' in opts ? opts.existingGrant : null);
  const grantFindMany = jest.fn().mockResolvedValue(opts.grants ?? []);
  const upsert = jest.fn().mockResolvedValue({ id: 'grant-1' });
  const update = jest.fn().mockResolvedValue({});
  const record = jest.fn().mockResolvedValue({});

  const prisma = {
    folder: { findFirst: folderFindFirst, findUnique: jest.fn().mockResolvedValue(null) },
    dataRoomMember: { findUnique: memberFindUnique },
    folderAccessGrant: { findUnique: grantFindUnique, findMany: grantFindMany, upsert, update, count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;

  const service = new FolderPermissionsService(
    prisma,
    { assertRoomManager } as unknown as DataRoomAccessService,
    { record } as unknown as AuditLogService,
  );

  return { service, assertRoomManager, folderFindFirst, memberFindUnique, grantFindUnique, upsert, update, record };
}

describe('FolderPermissionsService.grant', () => {
  it('is manager-tier only -- a non-manager is rejected before any folder/membership lookup', async () => {
    const assertRoomManager = jest.fn().mockRejectedValue(new ForbiddenException('Your role does not allow this action'));
    const { service, folderFindFirst } = buildService({ assertRoomManager });

    await expect(service.grant('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow(ForbiddenException);
    expect(folderFindFirst).not.toHaveBeenCalled();
  });

  it('404s on a folder that does not exist in this room', async () => {
    const { service } = buildService({ folder: null });
    await expect(service.grant('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow('Folder not found');
  });

  it('rejects granting access to someone who is not an active member of this room', async () => {
    const { service } = buildService({ membership: null });
    await expect(service.grant('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow(
      'Member not found in this data room',
    );
  });

  it('rejects granting access to a removed member', async () => {
    const { service } = buildService({ membership: { removedAt: new Date() } });
    await expect(service.grant('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow(
      'Member not found in this data room',
    );
  });

  it('grants and audit-logs FOLDER_ACCESS_GRANTED with the target user and folder name', async () => {
    const { service, upsert, record } = buildService({});

    await service.grant('room-1', 'folder-1', 'user-2', MANAGER);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { folderId_userId: { folderId: 'folder-1', userId: 'user-2' } },
        create: expect.objectContaining({ folderId: 'folder-1', userId: 'user-2', grantedBy: 'manager-1' }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FOLDER_ACCESS_GRANTED',
        dataRoomId: 'room-1',
        userId: 'manager-1',
        resourceId: 'folder-1',
        metadata: { targetUserId: 'user-2', folderName: 'Tax Documents' },
      }),
    );
  });

  it('is idempotent -- granting an already-active grant is a no-op, no duplicate audit entry', async () => {
    const { service, upsert, record } = buildService({ existingGrant: { revokedAt: null } });

    await service.grant('room-1', 'folder-1', 'user-2', MANAGER);

    expect(upsert).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('re-grants a previously revoked grant (clears revokedAt) rather than creating a second row', async () => {
    const { service, upsert } = buildService({ existingGrant: { revokedAt: new Date(), revokedBy: 'someone' } });

    await service.grant('room-1', 'folder-1', 'user-2', MANAGER);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ revokedAt: null, revokedBy: null }),
      }),
    );
  });
});

describe('FolderPermissionsService.revoke', () => {
  it('is manager-tier only', async () => {
    const assertRoomManager = jest.fn().mockRejectedValue(new ForbiddenException('nope'));
    const { service } = buildService({ assertRoomManager });

    await expect(service.revoke('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow(ForbiddenException);
  });

  it('404s when there is no active grant to revoke', async () => {
    const { service } = buildService({ existingGrant: null });
    await expect(service.revoke('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow(
      'No active folder access grant found for this user on this folder',
    );
  });

  it('404s when the grant is already revoked', async () => {
    const { service } = buildService({ existingGrant: { revokedAt: new Date() } });
    await expect(service.revoke('room-1', 'folder-1', 'user-2', MANAGER)).rejects.toThrow(NotFoundException);
  });

  it('revokes and audit-logs FOLDER_ACCESS_REVOKED', async () => {
    const { service, update, record } = buildService({ existingGrant: { revokedAt: null } });

    await service.revoke('room-1', 'folder-1', 'user-2', MANAGER);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { folderId_userId: { folderId: 'folder-1', userId: 'user-2' } },
        data: expect.objectContaining({ revokedBy: 'manager-1' }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FOLDER_ACCESS_REVOKED', metadata: { targetUserId: 'user-2', folderName: 'Tax Documents' } }),
    );
  });
});

describe('FolderPermissionsService.listAccess', () => {
  it('is manager-tier only', async () => {
    const assertRoomManager = jest.fn().mockRejectedValue(new ForbiddenException('nope'));
    const { service } = buildService({ assertRoomManager });

    await expect(service.listAccess('room-1', 'folder-1', MANAGER)).rejects.toThrow(ForbiddenException);
  });

  it('reports effectiveSource "own" when the folder has its own explicit grants', async () => {
    const { service } = buildService({
      grants: [
        {
          grantedAt: new Date(),
          grantedBy: 'manager-1',
          user: { id: 'user-2', firstName: 'A', lastName: 'B', email: 'a@b.com' },
        },
      ],
    });

    const result = await service.listAccess('room-1', 'folder-1', MANAGER);

    expect(result.effectiveSource).toEqual({ type: 'own' });
    expect(result.explicitGrants).toHaveLength(1);
  });

  it('reports effectiveSource "none" when this folder and nothing above it has any grants', async () => {
    const { service } = buildService({ grants: [] });

    const result = await service.listAccess('room-1', 'folder-1', MANAGER);

    expect(result.effectiveSource).toEqual({ type: 'none' });
  });
});
