import { ForbiddenException } from '@nestjs/common';
import { NdaService } from './nda.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

function buildService(opts: {
  membership?: { dataRoom: unknown; effectiveRole: string } | Error;
  acceptance?: unknown;
}) {
  const assertMembership =
    opts.membership instanceof Error
      ? jest.fn().mockRejectedValue(opts.membership)
      : jest.fn().mockResolvedValue(opts.membership);
  const findUnique = jest.fn().mockResolvedValue(opts.acceptance ?? null);
  const upsert = jest.fn().mockResolvedValue({});
  const record = jest.fn().mockResolvedValue({});

  const prisma = { ndaAcceptance: { findUnique, upsert } } as unknown as PrismaService;
  const dataRoomAccess = { assertMembership } as unknown as DataRoomAccessService;
  const auditLogService = { record } as unknown as AuditLogService;

  const service = new NdaService(prisma, auditLogService, dataRoomAccess);
  return { service, assertMembership, findUnique, upsert, record };
}

const ACTOR = { id: 'user-1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

// Regression coverage for the circular-lockout bug: NdaService previously
// called dataRoomAccess.getAccess(), which itself enforces the NDA gate --
// meaning no non-manager member could ever discover their NDA status or
// accept it once NDA was enabled, since both actions required the NDA to
// already be satisfied. assertMembership() breaks that cycle.
describe('NdaService.getStatus', () => {
  it('reports disabled without ever checking role or acceptance', async () => {
    const { service, findUnique } = buildService({
      membership: { dataRoom: { ndaEnabled: false, ndaText: null }, effectiveRole: 'PRA' },
    });

    const result = await service.getStatus('room-1', ACTOR);

    expect(result).toEqual({ enabled: false, text: null, hasAccepted: true });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('exempts a manager-tier effectiveRole without an acceptance row', async () => {
    const { service, findUnique } = buildService({
      membership: { dataRoom: { ndaEnabled: true, ndaText: 'Custom NDA text' }, effectiveRole: 'RP_LIQUIDATOR' },
    });

    const result = await service.getStatus('room-1', ACTOR);

    expect(result).toEqual({ enabled: true, text: 'Custom NDA text', hasAccepted: true });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('THE BUG: resolves (does not throw) for an ordinary member with no acceptance yet', async () => {
    const { service } = buildService({
      membership: { dataRoom: { ndaEnabled: true, ndaText: null }, effectiveRole: 'PRA' },
      acceptance: null,
    });

    const result = await service.getStatus('room-1', ACTOR);

    expect(result.hasAccepted).toBe(false);
    expect(result.enabled).toBe(true);
  });

  it('reports hasAccepted: true once an acceptance row exists', async () => {
    const { service } = buildService({
      membership: { dataRoom: { ndaEnabled: true, ndaText: null }, effectiveRole: 'PRA' },
      acceptance: { id: 'acc-1', acceptedAt: new Date() },
    });

    const result = await service.getStatus('room-1', ACTOR);

    expect(result.hasAccepted).toBe(true);
  });

  it('does not bypass membership -- a revoked/removed or unauthorized actor still gets rejected', async () => {
    const { service } = buildService({
      membership: new ForbiddenException('You do not have access to this data room'),
    });

    await expect(service.getStatus('room-1', ACTOR)).rejects.toThrow('You do not have access to this data room');
  });
});

describe('NdaService.accept', () => {
  it('rejects when the room does not have NDA enabled, without touching acceptance records', async () => {
    const { service, upsert, record } = buildService({
      membership: { dataRoom: { ndaEnabled: false }, effectiveRole: 'PRA' },
    });

    await expect(service.accept('room-1', ACTOR, '127.0.0.1')).rejects.toThrow(
      'This data room does not require NDA acceptance',
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('THE BUG: an ordinary member can accept when NDA is enabled and unaccepted', async () => {
    const { service, upsert, record } = buildService({
      membership: { dataRoom: { ndaEnabled: true }, effectiveRole: 'PRA' },
    });

    await service.accept('room-1', ACTOR, '127.0.0.1', 'jest-agent');

    expect(upsert).toHaveBeenCalledWith({
      where: { dataRoomId_userId: { dataRoomId: 'room-1', userId: 'user-1' } },
      update: expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: 'jest-agent' }),
      create: { dataRoomId: 'room-1', userId: 'user-1', ipAddress: '127.0.0.1', userAgent: 'jest-agent' },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NDA_ACCEPTED', dataRoomId: 'room-1', userId: 'user-1' }),
    );
  });

  it('a manager-tier member can also accept (bypass only applies to the read-side status, not blocked from writing one)', async () => {
    const { service, upsert } = buildService({
      membership: { dataRoom: { ndaEnabled: true }, effectiveRole: 'RP_LIQUIDATOR' },
    });

    await service.accept('room-1', ACTOR, '127.0.0.1');

    expect(upsert).toHaveBeenCalled();
  });

  it('does not bypass membership -- a revoked/removed or unauthorized actor cannot accept', async () => {
    const { service, upsert } = buildService({
      membership: new ForbiddenException('You do not have access to this data room'),
    });

    await expect(service.accept('room-1', ACTOR, '127.0.0.1')).rejects.toThrow(
      'You do not have access to this data room',
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});
