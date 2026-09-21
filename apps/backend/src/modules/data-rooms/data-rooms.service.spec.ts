import { DataRoomsService } from './data-rooms.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { AuditLogService } from '../audit/audit-log.service';
import type { MailService } from '../mail/mail.service';
import type { AuthService } from '../auth/auth.service';
import type { FoldersService } from '../folders/folders.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import type { InviteMemberDto } from './dto/invite-member.dto';

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
