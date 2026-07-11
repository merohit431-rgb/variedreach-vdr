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
