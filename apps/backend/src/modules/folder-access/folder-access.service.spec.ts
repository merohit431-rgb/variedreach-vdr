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

type Grant = { folderId: string; userId?: string | null; groupId?: string | null };

function buildService(opts: {
  folderAccessRestricted: boolean;
  grants?: Grant[];
  myGroupIds?: string[]; // groups the acting USER is an active member of
}) {
  const dataRoomFindUnique = jest.fn().mockResolvedValue({ folderAccessRestricted: opts.folderAccessRestricted });
  const folderFindMany = jest.fn().mockResolvedValue(FOLDERS);
  const grantFindMany = jest.fn().mockResolvedValue(
    (opts.grants ?? []).map((g) => ({ folderId: g.folderId, userId: g.userId ?? null, groupId: g.groupId ?? null })),
  );
  const groupMemberFindMany = jest
    .fn()
    .mockResolvedValue((opts.myGroupIds ?? []).map((groupId) => ({ groupId })));
  const record = jest.fn().mockResolvedValue({});

  const prisma = {
    dataRoom: { findUnique: dataRoomFindUnique },
    folder: { findMany: folderFindMany },
    folderAccessGrant: { findMany: grantFindMany },
    groupMember: { findMany: groupMemberFindMany },
  } as unknown as PrismaService;

  const service = new FolderAccessService(prisma, { record } as unknown as AuditLogService);
  return { service, record, grantFindMany, groupMemberFindMany };
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

describe('FolderAccessService.buildResolver -- group-based grants (Phase 3A.1)', () => {
  it('a group grant reaches a member of that group, exactly like a direct user grant would', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'legal-team' }],
      myGroupIds: ['legal-team'],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('C')).toBe(true);
    expect(resolver.canReach('C1')).toBe(true); // inherits, same as a user grant would
  });

  it('a group grant does NOT reach a user who is not a member of that group', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'legal-team' }],
      myGroupIds: [], // user-1 is not in legal-team
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('C')).toBe(false);
  });

  it('group membership and a direct user grant on the SAME folder both independently grant access (no conflict)', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [
        { folderId: 'C', userId: 'user-1' },
        { folderId: 'C', groupId: 'legal-team' },
      ],
      myGroupIds: ['legal-team'],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('C')).toBe(true);
  });

  // The nearest-grant-boundary rule applies identically regardless of
  // whether the closer boundary's grant list is user-type or group-type --
  // a more specific boundary that does not include this user (via either
  // mechanism) still overrides a broader parent grant.
  it('a closer group-grant boundary excluding this user overrides a broader parent user-grant', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [
        { folderId: 'D', userId: 'user-1' }, // parent: user-1 directly granted
        { folderId: 'D1', groupId: 'finance-team' }, // child boundary: a DIFFERENT group
      ],
      myGroupIds: ['legal-team'], // user-1 is not in finance-team
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('D')).toBe(true);
    expect(resolver.canReach('D1')).toBe(false);
  });

  it('a closer group-grant boundary that DOES include this user overrides a parent with no grant at all', async () => {
    const { service } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'D1', groupId: 'legal-team' }],
      myGroupIds: ['legal-team'],
    });
    const resolver = await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(resolver.canReach('D1')).toBe(true);
    expect(resolver.canReach('D')).toBe(false); // the parent itself has no boundary and no grant
  });

  it('removing the user from the group (no longer in myGroupIds) loses access on the next resolver build -- no stale cache', async () => {
    const before = await buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'legal-team' }],
      myGroupIds: ['legal-team'],
    }).service.buildResolver('room-1', USER, 'PRA' as never);
    expect(before.canReach('C')).toBe(true);

    // groupMember.findMany's own WHERE clause already excludes removed
    // memberships and deactivated/other-org groups -- simulated here by a
    // fresh build where the membership query simply returns nothing.
    const after = await buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'legal-team' }],
      myGroupIds: [],
    }).service.buildResolver('room-1', USER, 'PRA' as never);
    expect(after.canReach('C')).toBe(false);
  });

  it('queries group membership scoped to removedAt:null, the active group, and the actor\'s own org', async () => {
    // buildResolver's own groupMember.findMany call filters to
    // removedAt:null AND group.isActive:true AND group.organisationId ===
    // actor.organisationId -- this test documents that the resolver relies
    // entirely on that query's own WHERE clause and applies no further
    // filtering of its own (a deactivated group, a removed membership, or a
    // cross-org group can never reach the resolver's input sets at all).
    const { service, groupMemberFindMany } = buildService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'legal-team' }],
      myGroupIds: ['legal-team'],
    });
    await service.buildResolver('room-1', USER, 'PRA' as never);

    expect(groupMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          removedAt: null,
          group: { organisationId: 'org-1', isActive: true },
        }),
      }),
    );
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

// Phase 4 fix: notifyUpload() used to decide who to email about a new
// upload by querying the dead Permission model (nothing ever writes to it),
// so every external-role member was notified regardless of folder-ACL --
// leaking restricted folder names/document names to reviewers with no real
// FolderAccessGrant reach. buildBulkResolvers is the replacement: the same
// nearest-grant-boundary algorithm as buildResolver, run for many members
// of one room in a single batch of queries instead of one call per member
// (which would reintroduce the 2026-07-18 DB-pool-saturation incident
// notifyUpload's own comment describes).
describe('FolderAccessService.buildBulkResolvers', () => {
  type BulkGrant = { folderId: string; userId?: string | null; groupId?: string | null };

  function buildBulkService(opts: {
    folderAccessRestricted: boolean;
    grants?: BulkGrant[];
    // userId -> [{groupId, organisationId}] -- organisationId is the
    // GROUP's org, deliberately settable independently of the member's own
    // org so the cross-org safety test below can misalign them.
    groupMemberships?: Record<string, Array<{ groupId: string; organisationId: string }>>;
  }) {
    const dataRoomFindUnique = jest.fn().mockResolvedValue({ folderAccessRestricted: opts.folderAccessRestricted });
    const folderFindMany = jest.fn().mockResolvedValue(FOLDERS);
    const grantFindMany = jest.fn().mockResolvedValue(
      (opts.grants ?? []).map((g) => ({ folderId: g.folderId, userId: g.userId ?? null, groupId: g.groupId ?? null })),
    );
    const rows: Array<{ userId: string; groupId: string; group: { organisationId: string } }> = [];
    for (const [userId, memberships] of Object.entries(opts.groupMemberships ?? {})) {
      for (const m of memberships) rows.push({ userId, groupId: m.groupId, group: { organisationId: m.organisationId } });
    }
    const groupMemberFindMany = jest.fn().mockResolvedValue(rows);

    const prisma = {
      dataRoom: { findUnique: dataRoomFindUnique },
      folder: { findMany: folderFindMany },
      folderAccessGrant: { findMany: grantFindMany },
      groupMember: { findMany: groupMemberFindMany },
    } as unknown as PrismaService;

    const service = new FolderAccessService(prisma, { record: jest.fn() } as unknown as AuditLogService);
    return { service, dataRoomFindUnique, groupMemberFindMany };
  }

  it('returns null (unrestricted) when the room has folderAccessRestricted off, without querying folders/grants', async () => {
    const { service } = buildBulkService({ folderAccessRestricted: false });

    const resolvers = await service.buildBulkResolvers('room-1', [{ userId: 'user-1', organisationId: 'org-1' }]);

    expect(resolvers).toBeNull();
  });

  it('returns null for an empty member list without querying the room at all', async () => {
    const { service, dataRoomFindUnique } = buildBulkService({ folderAccessRestricted: true });

    const resolvers = await service.buildBulkResolvers('room-1', []);

    expect(resolvers).toBeNull();
    expect(dataRoomFindUnique).not.toHaveBeenCalled();
  });

  it('gives each user their own independent resolver based on their own user-grant', async () => {
    const { service } = buildBulkService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'D1', userId: 'user-1' }],
    });

    const resolvers = await service.buildBulkResolvers('room-1', [
      { userId: 'user-1', organisationId: 'org-1' },
      { userId: 'user-2', organisationId: 'org-1' },
    ]);

    expect(resolvers!.get('user-1')!.canReach('D1')).toBe(true);
    expect(resolvers!.get('user-2')!.canReach('D1')).toBe(false);
    // Un-boundaried folder (C) with no grant on it at all still default-denies.
    expect(resolvers!.get('user-1')!.canReach('C')).toBe(false);
    // Root is always reachable regardless of restriction.
    expect(resolvers!.get('user-1')!.canReach(null)).toBe(true);
  });

  it('honours group-based grants per user, batched in one query instead of one per member', async () => {
    const { service, groupMemberFindMany } = buildBulkService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'group-reviewers' }],
      groupMemberships: {
        'user-1': [{ groupId: 'group-reviewers', organisationId: 'org-1' }],
        // user-2 is in a different, unrelated group -- no reach.
        'user-2': [{ groupId: 'group-other', organisationId: 'org-1' }],
      },
    });

    const resolvers = await service.buildBulkResolvers('room-1', [
      { userId: 'user-1', organisationId: 'org-1' },
      { userId: 'user-2', organisationId: 'org-1' },
      { userId: 'user-3', organisationId: 'org-1' }, // no group membership at all
    ]);

    expect(resolvers!.get('user-1')!.canReach('C1')).toBe(true); // inherits C's grant
    expect(resolvers!.get('user-2')!.canReach('C1')).toBe(false);
    expect(resolvers!.get('user-3')!.canReach('C1')).toBe(false);
    expect(groupMemberFindMany).toHaveBeenCalledTimes(1); // one batched call, not one per member
  });

  it('never honours a group grant across organisations, even inside one batch call', async () => {
    const { service } = buildBulkService({
      folderAccessRestricted: true,
      grants: [{ folderId: 'C', groupId: 'group-x' }],
      groupMemberships: {
        // user-1 is genuinely in group-x, but group-x belongs to a
        // DIFFERENT org than user-1's own -- must not count.
        'user-1': [{ groupId: 'group-x', organisationId: 'org-OTHER' }],
      },
    });

    const resolvers = await service.buildBulkResolvers('room-1', [{ userId: 'user-1', organisationId: 'org-1' }]);

    expect(resolvers!.get('user-1')!.canReach('C1')).toBe(false);
  });

  it('folders/grants are fetched once for the whole batch, not once per member', async () => {
    const dataRoomFindUnique = jest.fn().mockResolvedValue({ folderAccessRestricted: true });
    const folderFindMany = jest.fn().mockResolvedValue(FOLDERS);
    const grantFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      dataRoom: { findUnique: dataRoomFindUnique },
      folder: { findMany: folderFindMany },
      folderAccessGrant: { findMany: grantFindMany },
      groupMember: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new FolderAccessService(prisma, { record: jest.fn() } as unknown as AuditLogService);

    await service.buildBulkResolvers('room-1', [
      { userId: 'user-1', organisationId: 'org-1' },
      { userId: 'user-2', organisationId: 'org-1' },
      { userId: 'user-3', organisationId: 'org-1' },
    ]);

    expect(folderFindMany).toHaveBeenCalledTimes(1);
    expect(grantFindMany).toHaveBeenCalledTimes(1);
  });
});
