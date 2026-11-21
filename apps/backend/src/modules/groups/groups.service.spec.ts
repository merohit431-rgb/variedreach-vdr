import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GroupsService } from './groups.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const ORG_ADMIN = { id: 'admin-1', organisationId: 'org-1', role: UserRole.ORG_ADMIN } as AuthenticatedUser;
const OTHER_ORG_ADMIN = { id: 'admin-2', organisationId: 'org-2', role: UserRole.ORG_ADMIN } as AuthenticatedUser;
const SUPER_ADMIN = { id: 'super-1', organisationId: 'org-1', role: UserRole.SUPER_ADMIN } as AuthenticatedUser;
const GROUP = { id: 'group-1', organisationId: 'org-1', name: 'Legal Team', isActive: true, createdAt: new Date() };

function buildService(opts: {
  org?: unknown;
  group?: unknown;
  membership?: unknown;
  groupMember?: unknown;
  members?: unknown[];
  folderGrants?: unknown[];
  groupList?: unknown[];
}) {
  const orgFindUnique = jest.fn().mockResolvedValue('org' in opts ? opts.org : { id: 'org-1' });
  const groupFindFirst = jest.fn().mockResolvedValue('group' in opts ? opts.group : GROUP);
  const groupFindMany = jest.fn().mockResolvedValue(opts.groupList ?? [{ ...GROUP, _count: { members: 0 } }]);
  const groupCreate = jest.fn().mockResolvedValue({ ...GROUP, id: 'new-group-1' });
  const groupUpdate = jest.fn().mockResolvedValue({ ...GROUP, name: 'Updated' });
  const groupMemberFindUnique = jest.fn().mockResolvedValue('groupMember' in opts ? opts.groupMember : null);
  const groupMemberFindMany = jest.fn().mockResolvedValue(opts.members ?? []);
  const groupMemberUpsert = jest.fn().mockResolvedValue({ groupId: 'group-1', userId: 'user-2' });
  const groupMemberUpdate = jest.fn().mockResolvedValue({});
  const orgMembershipFindUnique = jest.fn().mockResolvedValue('membership' in opts ? opts.membership : { userId: 'user-2', organisationId: 'org-1' });
  const folderGrantFindMany = jest.fn().mockResolvedValue(opts.folderGrants ?? []);
  const record = jest.fn().mockResolvedValue({});

  const prisma = {
    organisation: { findUnique: orgFindUnique },
    group: { findFirst: groupFindFirst, findMany: groupFindMany, create: groupCreate, update: groupUpdate },
    groupMember: {
      findUnique: groupMemberFindUnique,
      findMany: groupMemberFindMany,
      upsert: groupMemberUpsert,
      update: groupMemberUpdate,
    },
    organisationMembership: { findUnique: orgMembershipFindUnique },
    folderAccessGrant: { findMany: folderGrantFindMany },
  } as unknown as PrismaService;

  const service = new GroupsService(prisma, { record } as unknown as AuditLogService);

  return {
    service,
    orgFindUnique,
    groupFindFirst,
    groupCreate,
    groupUpdate,
    groupMemberFindUnique,
    groupMemberUpsert,
    groupMemberUpdate,
    orgMembershipFindUnique,
    record,
  };
}

describe('GroupsService -- org-scoped access control (assertOrgAccess)', () => {
  it('SUPER_ADMIN may manage any organisation', async () => {
    const { service } = buildService({});
    await expect(service.list('org-1', SUPER_ADMIN)).resolves.toBeDefined();
  });

  it('SUPER_ADMIN gets a 404, not a silent pass, when the organisation does not exist', async () => {
    const { service } = buildService({ org: null });
    await expect(service.list('ghost-org', SUPER_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('ORG_ADMIN may manage their own organisation', async () => {
    const { service } = buildService({});
    await expect(service.list('org-1', ORG_ADMIN)).resolves.toBeDefined();
  });

  it('ORG_ADMIN is rejected from a DIFFERENT organisation -- the cross-tenant boundary', async () => {
    const { service } = buildService({});
    await expect(service.list('org-1', OTHER_ORG_ADMIN)).rejects.toThrow(ForbiddenException);
  });

  it('a non-admin role (e.g. PRA) is rejected even for their own organisation', async () => {
    const { service } = buildService({});
    const pra = { id: 'u-1', organisationId: 'org-1', role: UserRole.PRA } as AuthenticatedUser;
    await expect(service.list('org-1', pra)).rejects.toThrow(ForbiddenException);
  });
});

describe('GroupsService.create', () => {
  it('creates a group scoped to the organisation and audits GROUP_CREATED', async () => {
    const { service, groupCreate, record } = buildService({});

    await service.create('org-1', { name: 'Finance Team' }, ORG_ADMIN);

    expect(groupCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { organisationId: 'org-1', name: 'Finance Team', createdBy: 'admin-1' } }),
    );
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'GROUP_CREATED' }));
  });

  it('a non-admin cannot create a group in any organisation', async () => {
    const { service, groupCreate } = buildService({});
    await expect(service.create('org-1', { name: 'X' }, OTHER_ORG_ADMIN)).rejects.toThrow(ForbiddenException);
    expect(groupCreate).not.toHaveBeenCalled();
  });
});

describe('GroupsService.update', () => {
  it('renames a group and audits GROUP_UPDATED with a from/to diff', async () => {
    const { service, groupUpdate, record } = buildService({ group: { ...GROUP, name: 'Legal Team' } });

    await service.update('org-1', 'group-1', { name: 'Legal & Compliance' }, ORG_ADMIN);

    expect(groupUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Legal & Compliance', isActive: true } }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GROUP_UPDATED',
        metadata: { name: { from: 'Legal Team', to: 'Legal & Compliance' } },
      }),
    );
  });

  it('deactivating a group audits isActive from/to', async () => {
    const { service, record } = buildService({ group: { ...GROUP, isActive: true } });

    await service.update('org-1', 'group-1', { isActive: false }, ORG_ADMIN);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { isActive: { from: true, to: false } } }),
    );
  });

  it('is a true no-op (no update call, no audit entry) when nothing actually changes', async () => {
    const { service, groupUpdate, record } = buildService({});

    await service.update('org-1', 'group-1', {}, ORG_ADMIN);

    expect(groupUpdate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('404s when the group does not exist in this organisation', async () => {
    const { service } = buildService({ group: null });
    await expect(service.update('org-1', 'ghost-group', { name: 'X' }, ORG_ADMIN)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('GroupsService.addMember', () => {
  it('adds a member and audits GROUP_MEMBER_ADDED', async () => {
    const { service, groupMemberUpsert, record } = buildService({});

    await service.addMember('org-1', 'group-1', 'user-2', ORG_ADMIN);

    expect(groupMemberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_userId: { groupId: 'group-1', userId: 'user-2' } },
        create: expect.objectContaining({ groupId: 'group-1', userId: 'user-2', addedBy: 'admin-1' }),
      }),
    );
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'GROUP_MEMBER_ADDED' }));
  });

  // The cross-tenant-pollution guard: a target user who does not belong to
  // THIS organisation at all must never be added to one of its groups --
  // without this, an Org Admin could pull an arbitrary user from another
  // organisation into a group that holds folder grants in their own org's
  // Data Rooms.
  it('rejects adding a user who has no membership in this organisation', async () => {
    const { service, groupMemberUpsert } = buildService({ membership: null });

    await expect(service.addMember('org-1', 'group-1', 'outsider-1', ORG_ADMIN)).rejects.toThrow(
      'User is not a member of this organisation',
    );
    expect(groupMemberUpsert).not.toHaveBeenCalled();
  });

  it('is idempotent -- re-adding an already-active member returns the existing row without a duplicate audit', async () => {
    const { service, groupMemberUpsert, record } = buildService({ groupMember: { removedAt: null } });

    await service.addMember('org-1', 'group-1', 'user-2', ORG_ADMIN);

    expect(groupMemberUpsert).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('re-adding a previously removed member clears removedAt rather than creating a second row', async () => {
    const { service, groupMemberUpsert } = buildService({ groupMember: { removedAt: new Date() } });

    await service.addMember('org-1', 'group-1', 'user-2', ORG_ADMIN);

    expect(groupMemberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ removedAt: null }) }),
    );
  });

  it('a non-admin cannot manage group membership via direct service call -- rejected before any member lookup', async () => {
    const { service, groupMemberUpsert } = buildService({});
    await expect(service.addMember('org-1', 'group-1', 'user-2', OTHER_ORG_ADMIN)).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupMemberUpsert).not.toHaveBeenCalled();
  });
});

describe('GroupsService.removeMember', () => {
  it('removes a member and audits GROUP_MEMBER_REMOVED', async () => {
    const { service, record } = buildService({ groupMember: { removedAt: null } });

    await service.removeMember('org-1', 'group-1', 'user-2', ORG_ADMIN);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GROUP_MEMBER_REMOVED', metadata: { targetUserId: 'user-2' } }),
    );
  });

  it('404s when the user is not currently an active member', async () => {
    const { service } = buildService({ groupMember: null });
    await expect(service.removeMember('org-1', 'group-1', 'user-2', ORG_ADMIN)).rejects.toThrow(
      'User is not a member of this group',
    );
  });

  it('404s when the membership was already removed', async () => {
    const { service } = buildService({ groupMember: { removedAt: new Date() } });
    await expect(service.removeMember('org-1', 'group-1', 'user-2', ORG_ADMIN)).rejects.toThrow(NotFoundException);
  });
});

describe('GroupsService.getGroup', () => {
  it('returns members and folder grants for a group in the caller\'s own organisation', async () => {
    const { service } = buildService({
      members: [
        {
          user: { id: 'user-2', firstName: 'A', lastName: 'B', email: 'a@b.com', role: UserRole.PRA },
          addedAt: new Date(),
        },
      ],
      folderGrants: [{ folder: { id: 'folder-1', name: 'Tax Docs', dataRoomId: 'room-1' }, grantedAt: new Date() }],
    });

    const result = await service.getGroup('org-1', 'group-1', ORG_ADMIN);

    expect(result.members).toHaveLength(1);
    expect(result.folderGrants).toHaveLength(1);
  });

  it('rejects a cross-tenant caller before ever querying this group\'s members', async () => {
    const { service, groupFindFirst } = buildService({});
    await expect(service.getGroup('org-1', 'group-1', OTHER_ORG_ADMIN)).rejects.toThrow(ForbiddenException);
    expect(groupFindFirst).not.toHaveBeenCalled();
  });
});
