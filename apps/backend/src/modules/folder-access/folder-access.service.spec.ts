import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FolderAccessService } from './folder-access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

// Tree used throughout, matching the Phase 1 worked examples:
//   A (Financial Information)
//   D (Corporate Documents)
//     D1 (Board Resolutions -- Confidential)
//   C (Tax Documents)
//     C1 (Tax Returns)
//     C2 (Tax Litigation)
const FOLDERS = [
  { id: 'A', parentId: null },
  { id: 'D', parentId: null },
  { id: 'D1', parentId: 'D' },
  { id: 'C', parentId: null },
  { id: 'C1', parentId: 'C' },
  { id: 'C2', parentId: 'C' },
];

function buildService(opts: { folderAccessRestricted: boolean; grants?: { folderId: string; userId: string }[] }) {
  const dataRoomFindUnique = jest.fn().mockResolvedValue({ folderAccessRestricted: opts.folderAccessRestricted });
  const folderFindMany = jest.fn().mockResolvedValue(FOLDERS);
  const grantFindMany = jest.fn().mockResolvedValue(opts.grants ?? []);
  const record = jest.fn().mockResolvedValue({});

  const prisma = {
    dataRoom: { findUnique: dataRoomFindUnique },
    folder: { findMany: folderFindMany },
    folderAccessGrant: { findMany: grantFindMany },
  } as unknown as PrismaService;

  const service = new FolderAccessService(prisma, { record } as unknown as AuditLogService);
  return { service, record, grantFindMany };
}

const USER = { id: 'user-1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

describe('FolderAccessService.buildResolver -- unrestricted rooms and manager bypass', () => {
  it('is fully unrestricted when folderAccessRestricted is false -- zero grant/folder queries', async () => {
    const { service, grantFindMany } = buildService({ folderAccessRestricted: false });

    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.unrestricted).toBe(true);
    expect(resolver.canReach('D1')).toBe(true);
    expect(grantFindMany).not.toHaveBeenCalled();
  });

  it('is fully unrestricted for a manager-tier effectiveRole even when the room is restricted', async () => {
    const { service, grantFindMany } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', userId: 'someone-else' }],
    });

    const resolver = await service.buildResolver('room-1', USER, 'RP_LIQUIDATOR' as never);

    expect(resolver.unrestricted).toBe(true);
    expect(resolver.canReach('C1')).toBe(true); // not even in the grant list
    expect(grantFindMany).not.toHaveBeenCalled();
  });
});

describe('FolderAccessService.buildResolver -- nearest-grant-boundary resolution', () => {
  it('a direct grant on a child does not leak to its parent or its sibling', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C1', userId: 'user-1' }],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('C1')).toBe(true);
    expect(resolver.canReach('C2')).toBe(false); // sibling -- no leak
    expect(resolver.canReach('C')).toBe(false); // parent -- a child grant never projects upward
  });

  it('a grant on a parent reaches every descendant that has no boundary of its own', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', userId: 'user-1' }],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('C')).toBe(true);
    expect(resolver.canReach('C1')).toBe(true);
    expect(resolver.canReach('C2')).toBe(true);
  });

  // THE core conflict-resolution rule: the walk stops at the NEAREST folder
  // that has ANY live grant at all (a "boundary"), not at the nearest
  // ancestor where THIS user specifically has one. A more specific boundary
  // that excludes the user is authoritative -- the parent's broader grant
  // never reaches past it, even though the parent's grant exists and would
  // otherwise have covered this folder.
  it('explicit restriction on one branch: a closer boundary excluding the user wins over a broader parent grant', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [
        { folderId: 'D', userId: 'user-1' }, // parent: user-1 IS granted here
        { folderId: 'D1', userId: 'someone-else' }, // child has its OWN boundary, excluding user-1
      ],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('D')).toBe(true); // parent: fine, directly granted
    expect(resolver.canReach('D1')).toBe(false); // child: its own boundary doesn't include user-1
  });

  it('a top-level folder with no boundary anywhere above it defaults to no access', async () => {
    const { service } = buildService({ folderAccessRestricted: true, grants: [] });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('A')).toBe(false);
  });

  it('the Data Room root (folderId: null) is always reachable -- it is not a grantable folder', async () => {
    const { service } = buildService({ folderAccessRestricted: true, grants: [] });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach(null)).toBe(true);
  });

  it('a folder id that does not belong to this room at all resolves to false, not an error', async () => {
    const { service } = buildService({ folderAccessRestricted: true, grants: [] });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('not-a-real-folder-in-this-room')).toBe(false);
  });

  it('revoking the one grant a branch depended on removes the whole branch in one write (reflected on the next resolver build)', async () => {
    const before = await buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'D', userId: 'user-1' }],
    }).service.buildResolver('room-1', USER, 'PRA' as never);
    expect(before.canReach('D1')).toBe(true);

    // The grant row is gone (revoked) -- a fresh resolver build (as every
    // real request performs) sees the new state immediately.
    const after = await buildService({ folderAccessRestricted: true, grants: [] }).service.buildResolver(
      'room-1',
      USER,
      'PRA' as never,
    );
    expect(after.canReach('D')).toBe(false);
    expect(after.canReach('D1')).toBe(false);
  });

  it('reachableFolderIds() returns exactly the set canReach() would say yes to', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', userId: 'user-1' }],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    const ids = resolver.reachableFolderIds();
    expect([...ids].sort()).toEqual(['C', 'C1', 'C2']);
  });
});

describe('FolderAccessService.assertReachable', () => {
  it('resolves without throwing or auditing when unrestricted', async () => {
    const { service, record } = buildService({ folderAccessRestricted: false });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    await expect(
      service.assertReachable(resolver, 'A', 'Folder not found', {
        dataRoomId: 'room-1',
        actor: USER,
        resourceType: 'Folder',
        resourceId: 'A',
      }),
    ).resolves.toBeUndefined();
    expect(record).not.toHaveBeenCalled();
  });

  it('throws the EXACT message passed in, and audits FOLDER_ACCESS_DENIED, when unreachable', async () => {
    const { service, record } = buildService({ folderAccessRestricted: true, grants: [] });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    await expect(
      service.assertReachable(resolver, 'A', 'Folder not found', {
        dataRoomId: 'room-1',
        actor: USER,
        resourceType: 'Folder',
        resourceId: 'A',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.assertReachable(resolver, 'A', 'Folder not found', {
        dataRoomId: 'room-1',
        actor: USER,
        resourceType: 'Folder',
        resourceId: 'A',
      }),
    ).rejects.toThrow('Folder not found');

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FOLDER_ACCESS_DENIED', dataRoomId: 'room-1', userId: 'user-1' }),
    );
  });

  it('a failure to write the denial record never masks the real NotFoundException', async () => {
    const { service, record } = buildService({ folderAccessRestricted: true, grants: [] });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);
    record.mockRejectedValueOnce(new Error('audit db blip'));

    await expect(
      service.assertReachable(resolver, 'A', 'File not found', {
        dataRoomId: 'room-1',
        actor: USER,
        resourceType: 'File',
        resourceId: 'file-9',
      }),
    ).rejects.toThrow('File not found');
  });

  it('resolves silently (no throw, no audit) when the folder is reachable', async () => {
    const { service, record } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'A', userId: 'user-1' }],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    await expect(
      service.assertReachable(resolver, 'A', 'Folder not found', {
        dataRoomId: 'room-1',
        actor: USER,
        resourceType: 'Folder',
        resourceId: 'A',
      }),
    ).resolves.toBeUndefined();
    expect(record).not.toHaveBeenCalled();
  });
});

// Not used by the resolver itself, but documents an intentional non-goal:
// ForbiddenException is never thrown by this service -- every denial is a
// NotFoundException so an unreachable folder/file is indistinguishable from
// one that was never real.
describe('FolderAccessService never throws ForbiddenException', () => {
  it('assertReachable always rejects with NotFoundException, never ForbiddenException', async () => {
    const { service } = buildService({ folderAccessRestricted: true, grants: [] });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    const rejection = service.assertReachable(resolver, 'A', 'Folder not found', {
      dataRoomId: 'room-1',
      actor: USER,
      resourceType: 'Folder',
      resourceId: 'A',
    });
    await expect(rejection).rejects.not.toBeInstanceOf(ForbiddenException);
    await expect(rejection).rejects.toBeInstanceOf(NotFoundException);
  });
});
