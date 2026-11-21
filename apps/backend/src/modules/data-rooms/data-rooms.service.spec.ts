import { DataRoomsService } from './data-rooms.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { DataRoomType } from '@prisma/client';
import type { AuditLogService } from '../audit/audit-log.service';
import type { MailService } from '../mail/mail.service';
import type { AuthService } from '../auth/auth.service';
import type { FoldersService } from '../folders/folders.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { FolderAccessService } from '../folder-access/folder-access.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { CreateDataRoomDto } from './dto/create-data-room.dto';

// Every test in this file predates folder-ACL and exercises room-level
// behaviour only -- a resolver that's always unrestricted keeps all of them
// exactly as they were. Folder-ACL-specific resolution has its own
// dedicated tests in folder-access.service.spec.ts.
const UNRESTRICTED_FOLDER_ACCESS = {
  buildResolver: jest.fn().mockResolvedValue({
    unrestricted: true,
    canReach: () => true,
    reachableFolderIds: () => new Set<string>(),
  }),
} as unknown as FolderAccessService;

describe('DataRoomsService email normalization', () => {
  it('inviteMember() normalizes a mixed-case, padded email before looking up the invitee', async () => {
    // assertManager() runs first and must succeed to reach the email lookup.
    const dataRoomFindFirst = jest.fn().mockResolvedValue({ id: 'room-1', organisationId: 'org-1' });
    // Reject deliberately -- proves the query args without mocking the rest
    // of inviteMember()'s create/upsert/email-sending flow.
    const userFindUnique = jest.fn().mockRejectedValue(new Error('STOP_HERE'));

    const prisma = {
      dataRoom: { findFirst: dataRoomFindFirst },
      user: { findUnique: userFindUnique },
    } as unknown as PrismaService;

    const service = new DataRoomsService(
      prisma,
      {} as ConfigService,
      {} as AuditLogService,
      {} as MailService,
      {} as AuthService,
      {} as FoldersService,
      {} as DataRoomAccessService,
      UNRESTRICTED_FOLDER_ACCESS,
    );

    const actor = { id: 'actor-1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;
    const dto = {
      email: '  Bhumika.Batra@CrawfordBayley.com  ',
      fullName: 'Bhumika Batra',
      role: 'PRA',
    } as InviteMemberDto;

    await expect(service.inviteMember('room-1', dto, actor)).rejects.toThrow('STOP_HERE');

    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: 'bhumika.batra@crawfordbayley.com' } });
  });
});

function buildRestoreService(overrides: {
  dataRoom?: unknown;
  update?: jest.Mock;
  record?: jest.Mock;
}) {
  const record = overrides.record ?? jest.fn().mockResolvedValue({});
  const update = overrides.update ?? jest.fn().mockResolvedValue({});
  const prisma = {
    dataRoom: {
      findFirst: jest.fn().mockResolvedValue(overrides.dataRoom ?? null),
      update,
    },
  } as unknown as PrismaService;
  const auditLogService = { record } as unknown as AuditLogService;
  const service = new DataRoomsService(
    prisma,
    {} as ConfigService,
    auditLogService,
    {} as MailService,
    {} as AuthService,
    {} as FoldersService,
    {} as DataRoomAccessService,
    UNRESTRICTED_FOLDER_ACCESS,
  );
  return { service, prisma, record, update };
}

// restore() deliberately does NOT reuse assertManager() -- that helper
// filters deletedAt: null, which would make a deleted room permanently
// unreachable through it, including for the one operation that exists
// specifically to undo the deletion. This regression-tests that this
// lookup, unlike assertManager's, can actually find a deleted row.
describe('DataRoomsService.restore', () => {
  it('rejects a non-manager role before even looking up the room', async () => {
    const { service, prisma } = buildRestoreService({});
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    await expect(service.restore('room-1', actor)).rejects.toThrow('You do not have permission');
    expect(prisma.dataRoom.findFirst).not.toHaveBeenCalled();
  });

  it('404s when the room does not exist in the actor\'s organisation', async () => {
    const { service } = buildRestoreService({ dataRoom: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await expect(service.restore('room-1', actor)).rejects.toThrow('Data room not found');
  });

  it('rejects restoring a room that is not actually deleted', async () => {
    const { service } = buildRestoreService({ dataRoom: { id: 'room-1', deletedAt: null } });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await expect(service.restore('room-1', actor)).rejects.toThrow('not deleted');
  });

  it('clears deletedAt and audit-logs the restore for an actually-deleted room', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'room-1', deletedAt: null });
    const { service, record } = buildRestoreService({
      dataRoom: { id: 'room-1', deletedAt: new Date('2026-01-01') },
      update,
    });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'RP_LIQUIDATOR' } as AuthenticatedUser;

    await service.restore('room-1', actor);

    expect(update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { deletedAt: null } });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DATA_ROOM_UPDATED', metadata: { restored: true } }),
    );
  });
});

function buildTemplateService(template: unknown) {
  const findUnique = jest.fn().mockResolvedValue(template);
  const prisma = { dataRoomTemplate: { findUnique } } as unknown as PrismaService;
  const service = new DataRoomsService(
    prisma,
    {} as ConfigService,
    {} as AuditLogService,
    {} as MailService,
    {} as AuthService,
    {} as FoldersService,
    {} as DataRoomAccessService,
    UNRESTRICTED_FOLDER_ACCESS,
  );
  return { service, findUnique };
}

// getTemplate() is the read-side preview the "apply standard folder
// template" toggle on the create-room form uses -- both to decide whether
// to show itself at all, and to render the folder tree before creation.
describe('DataRoomsService.getTemplate', () => {
  it('returns null when no template row exists for the type -- callers hide the toggle entirely', async () => {
    const { service } = buildTemplateService(null);

    expect(await service.getTemplate('OTHER' as DataRoomType)).toBeNull();
  });

  it('returns null for a template row that has been deactivated', async () => {
    const { service } = buildTemplateService({ id: 'tpl-1', isActive: false, folders: [] });

    expect(await service.getTemplate('CIRP' as DataRoomType)).toBeNull();
  });

  it('builds a nested folder tree and folderCount from the flat template.folders rows', async () => {
    const { service } = buildTemplateService({
      id: 'tpl-ipo',
      name: 'IPO Data Room',
      description: 'Standard IPO structure',
      isActive: true,
      folders: [
        { id: 'f-corp', parentId: null, name: 'Corporate Information' },
        { id: 'f-moa', parentId: 'f-corp', name: 'MOA & AOA' },
      ],
    });

    const result = await service.getTemplate('IPO' as DataRoomType);

    expect(result).toEqual({
      id: 'tpl-ipo',
      name: 'IPO Data Room',
      description: 'Standard IPO structure',
      folderCount: 2,
      folders: [{ name: 'Corporate Information', children: [{ name: 'MOA & AOA', children: [] }] }],
    });
  });
});

function buildCreateService(template: unknown) {
  const dataRoomCreate = jest.fn().mockResolvedValue({ id: 'room-1' });
  const templateFindUnique = jest.fn().mockResolvedValue(template);
  const seedFromTemplate = jest.fn().mockResolvedValue(undefined);
  const record = jest.fn().mockResolvedValue({});

  const prisma = {
    dataRoom: { create: dataRoomCreate },
    dataRoomTemplate: { findUnique: templateFindUnique },
  } as unknown as PrismaService;

  const service = new DataRoomsService(
    prisma,
    {} as ConfigService,
    { record } as unknown as AuditLogService,
    {} as MailService,
    {} as AuthService,
    { seedFromTemplate } as unknown as FoldersService,
    {} as DataRoomAccessService,
    UNRESTRICTED_FOLDER_ACCESS,
  );

  return { service, seedFromTemplate, record, templateFindUnique };
}

const CREATE_ACTOR = { id: 'actor-1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

// create()'s database-backed template lookup replaced the old hardcoded
// `if (type === 'CIRP')` branch -- any DataRoomType can have a template row,
// and applyTemplate defaults to true so every pre-existing caller keeps
// getting the same auto-seed behaviour it always did.
describe('DataRoomsService.create template application', () => {
  it('applies the template and audit-logs it when applyTemplate is omitted and an active template exists', async () => {
    const template = { id: 'tpl-cirp', name: 'CIRP Standard', isActive: true };
    const { service, seedFromTemplate, record } = buildCreateService(template);

    await service.create({ name: 'Room A', type: 'CIRP' } as CreateDataRoomDto, CREATE_ACTOR);

    expect(seedFromTemplate).toHaveBeenCalledWith('room-1', 'tpl-cirp', 'actor-1');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DATA_ROOM_TEMPLATE_APPLIED',
        metadata: { templateId: 'tpl-cirp', templateName: 'CIRP Standard' },
      }),
    );
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'DATA_ROOM_CREATED' }));
  });

  it('skips the template entirely when applyTemplate: false is passed, even though an active template exists', async () => {
    const template = { id: 'tpl-cirp', name: 'CIRP Standard', isActive: true };
    const { service, seedFromTemplate, record } = buildCreateService(template);

    await service.create({ name: 'Room A', type: 'CIRP', applyTemplate: false } as CreateDataRoomDto, CREATE_ACTOR);

    expect(seedFromTemplate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'DATA_ROOM_TEMPLATE_APPLIED' }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'DATA_ROOM_CREATED' }));
  });

  it('does nothing template-related for a type with no template row -- other categories are unaffected', async () => {
    const { service, seedFromTemplate, record } = buildCreateService(null);

    await service.create({ name: 'Room A', type: 'OTHER' } as CreateDataRoomDto, CREATE_ACTOR);

    expect(seedFromTemplate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'DATA_ROOM_TEMPLATE_APPLIED' }));
  });

  it('does not apply a template that has been deactivated', async () => {
    const { service, seedFromTemplate } = buildCreateService({ id: 'tpl-x', name: 'X', isActive: false });

    await service.create({ name: 'Room A', type: 'CIRP' } as CreateDataRoomDto, CREATE_ACTOR);

    expect(seedFromTemplate).not.toHaveBeenCalled();
  });
});

function buildDownloadOriginalService(overrides: { dataRoom?: unknown; member?: unknown; update?: jest.Mock }) {
  const update = overrides.update ?? jest.fn().mockResolvedValue({});
  const record = jest.fn().mockResolvedValue({});
  const memberFindUnique = jest.fn().mockResolvedValue(overrides.member ?? null);

  const prisma = {
    dataRoom: { findFirst: jest.fn().mockResolvedValue(overrides.dataRoom ?? { id: 'room-1', deletedAt: null }) },
    dataRoomMember: { findUnique: memberFindUnique, update },
  } as unknown as PrismaService;

  const service = new DataRoomsService(
    prisma,
    {} as ConfigService,
    { record } as unknown as AuditLogService,
    {} as MailService,
    {} as AuthService,
    {} as FoldersService,
    {} as DataRoomAccessService,
    UNRESTRICTED_FOLDER_ACCESS,
  );

  return { service, memberFindUnique, update, record };
}

const MANAGER_ACTOR = { id: 'manager-1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

// The dedicated DOWNLOAD_ORIGINAL permission is a per-member, explicit
// opt-in -- off by default, never a consequence of role, toggled through its
// own endpoint rather than folded into updateMemberRole.
describe('DataRoomsService.setMemberDownloadOriginal', () => {
  it('rejects a non-manager role before looking up the member', async () => {
    const { service, memberFindUnique } = buildDownloadOriginalService({});
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    await expect(service.setMemberDownloadOriginal('room-1', 'target-1', true, actor)).rejects.toThrow(
      'You do not have permission',
    );
    expect(memberFindUnique).not.toHaveBeenCalled();
  });

  it('404s when the member does not exist in this room', async () => {
    const { service } = buildDownloadOriginalService({ member: null });

    await expect(
      service.setMemberDownloadOriginal('room-1', 'target-1', true, MANAGER_ACTOR),
    ).rejects.toThrow('Member not found in this data room');
  });

  it('404s when the member was removed from this room', async () => {
    const { service } = buildDownloadOriginalService({ member: { canDownloadOriginal: false, removedAt: new Date() } });

    await expect(
      service.setMemberDownloadOriginal('room-1', 'target-1', true, MANAGER_ACTOR),
    ).rejects.toThrow('Member not found in this data room');
  });

  it('is a no-op (no update, no audit log) when the flag already matches the requested value', async () => {
    const { service, update, record } = buildDownloadOriginalService({
      member: { canDownloadOriginal: true, removedAt: null },
    });

    await service.setMemberDownloadOriginal('room-1', 'target-1', true, MANAGER_ACTOR);

    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('updates the flag and audit-logs a from/to transition when actually toggling', async () => {
    const { service, update, record } = buildDownloadOriginalService({
      member: { canDownloadOriginal: false, removedAt: null },
    });

    await service.setMemberDownloadOriginal('room-1', 'target-1', true, MANAGER_ACTOR);

    expect(update).toHaveBeenCalledWith({
      where: { dataRoomId_userId: { dataRoomId: 'room-1', userId: 'target-1' } },
      data: { canDownloadOriginal: true },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOWNLOAD_ORIGINAL_PERMISSION_CHANGED',
        metadata: { from: false, to: true },
      }),
    );
  });
});

function buildFolderRestrictionService(dataRoom: unknown) {
  const update = jest.fn().mockResolvedValue({ ...(dataRoom as object), folderAccessRestricted: true });
  const record = jest.fn().mockResolvedValue({});
  const prisma = {
    dataRoom: { findFirst: jest.fn().mockResolvedValue(dataRoom), update },
  } as unknown as PrismaService;

  const service = new DataRoomsService(
    prisma,
    {} as ConfigService,
    { record } as unknown as AuditLogService,
    {} as MailService,
    {} as AuthService,
    {} as FoldersService,
    {} as DataRoomAccessService,
    UNRESTRICTED_FOLDER_ACCESS,
  );
  return { service, update, record };
}

// The backward-compatibility switch at the center of Phase 3A -- this is
// the ONLY code path that can ever turn folder-level restriction on.
describe('DataRoomsService.setFolderAccessRestricted', () => {
  it('rejects a non-manager before touching the room', async () => {
    const { service } = buildFolderRestrictionService({ id: 'room-1', folderAccessRestricted: false });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    await expect(service.setFolderAccessRestricted('room-1', true, actor)).rejects.toThrow(
      'You do not have permission',
    );
  });

  it('is a no-op (no update, no audit) when the flag already matches', async () => {
    const { service, update, record } = buildFolderRestrictionService({
      id: 'room-1',
      folderAccessRestricted: true,
    });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await service.setFolderAccessRestricted('room-1', true, actor);

    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('flips the flag and audit-logs DATA_ROOM_FOLDER_RESTRICTION_TOGGLED with from/to', async () => {
    const { service, update, record } = buildFolderRestrictionService({
      id: 'room-1',
      folderAccessRestricted: false,
    });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await service.setFolderAccessRestricted('room-1', true, actor);

    expect(update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { folderAccessRestricted: true } });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DATA_ROOM_FOLDER_RESTRICTION_TOGGLED',
        metadata: { from: false, to: true },
      }),
    );
  });
});

describe('DataRoomsService.create -- folderAccessRestricted opt-in', () => {
  it('defaults to false and audits nothing extra when omitted', async () => {
    const dataRoomCreate = jest.fn().mockResolvedValue({ id: 'room-1' });
    const record = jest.fn().mockResolvedValue({});
    const prisma = {
      dataRoom: { create: dataRoomCreate },
      dataRoomTemplate: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const service = new DataRoomsService(
      prisma,
      {} as ConfigService,
      { record } as unknown as AuditLogService,
      {} as MailService,
      {} as AuthService,
      { seedFromTemplate: jest.fn() } as unknown as FoldersService,
      {} as DataRoomAccessService,
      UNRESTRICTED_FOLDER_ACCESS,
    );
    const actor = { id: 'actor-1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await service.create({ name: 'Room A', type: 'IPO' } as CreateDataRoomDto, actor);

    expect(dataRoomCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ folderAccessRestricted: false }) }),
    );
    expect(record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DATA_ROOM_FOLDER_RESTRICTION_TOGGLED' }),
    );
  });

  it('honors an explicit true and audits DATA_ROOM_FOLDER_RESTRICTION_TOGGLED at creation', async () => {
    const dataRoomCreate = jest.fn().mockResolvedValue({ id: 'room-1' });
    const record = jest.fn().mockResolvedValue({});
    const prisma = {
      dataRoom: { create: dataRoomCreate },
      dataRoomTemplate: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const service = new DataRoomsService(
      prisma,
      {} as ConfigService,
      { record } as unknown as AuditLogService,
      {} as MailService,
      {} as AuthService,
      { seedFromTemplate: jest.fn() } as unknown as FoldersService,
      {} as DataRoomAccessService,
      UNRESTRICTED_FOLDER_ACCESS,
    );
    const actor = { id: 'actor-1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await service.create({ name: 'Room A', type: 'IPO', folderAccessRestricted: true } as CreateDataRoomDto, actor);

    expect(dataRoomCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ folderAccessRestricted: true }) }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DATA_ROOM_FOLDER_RESTRICTION_TOGGLED',
        metadata: { from: false, to: true, atCreation: true },
      }),
    );
  });
});

describe('DataRoomsService.getStats -- folder counts filtered to reachable folders', () => {
  it('returns only reachable folders\' counts, and a documents total excluding unreachable ones', async () => {
    const getAccess = jest.fn().mockResolvedValue({ effectiveRole: 'PRA' });
    const buildResolver = jest.fn().mockResolvedValue({
      unrestricted: false,
      canReach: (id: string | null) => id === 'folder-reachable',
    });
    const prisma = {
      dataRoomMember: { count: jest.fn().mockResolvedValue(3) },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
      file: {
        groupBy: jest.fn().mockResolvedValue([
          { folderId: 'folder-reachable', _count: { _all: 5 } },
          { folderId: 'folder-hidden', _count: { _all: 12 } },
        ]),
      },
      organisation: { findUnique: jest.fn().mockResolvedValue({ storageLimitGb: 10 }) },
      dataRoom: { aggregate: jest.fn().mockResolvedValue({ _sum: { storageUsedBytes: 0n } }) },
    } as unknown as PrismaService;

    const service = new DataRoomsService(
      prisma,
      {} as ConfigService,
      {} as AuditLogService,
      {} as MailService,
      {} as AuthService,
      {} as FoldersService,
      { getAccess } as unknown as DataRoomAccessService,
      { buildResolver } as unknown as FolderAccessService,
    );
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    const stats = await service.getStats('room-1', actor);

    expect(stats.folderCounts).toEqual({ 'folder-reachable': 5 });
    expect(stats.documents).toBe(5);
  });
});
