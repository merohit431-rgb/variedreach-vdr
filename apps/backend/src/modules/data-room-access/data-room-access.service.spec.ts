import { ForbiddenException } from '@nestjs/common';
import { DataRoomAccessService } from './data-room-access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const ROOM = {
  id: 'room-1',
  organisationId: 'org-1',
  deletedAt: null,
  ipAllowlistEnabled: false,
  allowedIps: [] as string[],
  ndaEnabled: false,
  ndaText: null,
};

function buildService(membership: unknown) {
  const dataRoomFindFirst = jest.fn().mockResolvedValue(ROOM);
  const memberFindUnique = jest.fn().mockResolvedValue(membership);

  const prisma = {
    dataRoom: { findFirst: dataRoomFindFirst },
    dataRoomMember: { findUnique: memberFindUnique },
  } as unknown as PrismaService;

  return { service: new DataRoomAccessService(prisma), memberFindUnique };
}

// canDownloadOriginal is a deliberately narrower grant than org-wide admin
// status: only SUPER_ADMIN bypasses it outright; everyone else -- ORG_ADMIN
// included -- needs the explicit per-member DataRoomMember.canDownloadOriginal
// flag. These tests pin that asymmetry down.
describe('DataRoomAccessService.getAccess canDownloadOriginal resolution', () => {
  it('grants SUPER_ADMIN canDownloadOriginal without ever looking up a membership row', async () => {
    const { service, memberFindUnique } = buildService(null);
    const actor = { id: 'u1', organisationId: 'org-1', role: 'SUPER_ADMIN' } as AuthenticatedUser;

    const access = await service.getAccess('room-1', actor);

    expect(access.canDownloadOriginal).toBe(true);
    expect(memberFindUnique).not.toHaveBeenCalled();
  });

  it('does NOT grant ORG_ADMIN canDownloadOriginal just for being org-wide -- false with no membership row', async () => {
    const { service } = buildService(null);
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    const access = await service.getAccess('room-1', actor);

    expect(access.canDownloadOriginal).toBe(false);
    expect(access.effectiveRole).toBe('ORG_ADMIN');
  });

  it('grants ORG_ADMIN canDownloadOriginal when their membership row has the flag set', async () => {
    const { service } = buildService({ roleOverride: null, canDownloadOriginal: true, removedAt: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    const access = await service.getAccess('room-1', actor);

    expect(access.canDownloadOriginal).toBe(true);
  });

  it('reads canDownloadOriginal from the membership row for a non-org-wide member (e.g. PRA)', async () => {
    const { service } = buildService({ roleOverride: null, canDownloadOriginal: true, removedAt: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    const access = await service.getAccess('room-1', actor);

    expect(access.canDownloadOriginal).toBe(true);
  });

  it('defaults a non-org-wide member with no flag set to canDownloadOriginal: false', async () => {
    const { service } = buildService({ roleOverride: null, canDownloadOriginal: false, removedAt: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    const access = await service.getAccess('room-1', actor);

    expect(access.canDownloadOriginal).toBe(false);
  });
});

describe('DataRoomAccessService.assertCanDownloadOriginal', () => {
  it('throws ForbiddenException when the actor lacks the permission', async () => {
    const { service } = buildService(null);
    const actor = { id: 'u1', organisationId: 'org-1', role: 'ORG_ADMIN' } as AuthenticatedUser;

    await expect(service.assertCanDownloadOriginal('room-1', actor)).rejects.toThrow(ForbiddenException);
    await expect(service.assertCanDownloadOriginal('room-1', actor)).rejects.toThrow(
      'You do not have permission to download the original, unwatermarked file',
    );
  });

  it('resolves with the access object when the actor has the permission', async () => {
    const { service } = buildService(null);
    const actor = { id: 'u1', organisationId: 'org-1', role: 'SUPER_ADMIN' } as AuthenticatedUser;

    const access = await service.assertCanDownloadOriginal('room-1', actor);

    expect(access.canDownloadOriginal).toBe(true);
  });
});

function buildNdaScenarioService(opts: { membership: unknown; acceptance?: unknown }) {
  const room = { ...ROOM, ndaEnabled: true, ndaText: null };
  const dataRoomFindFirst = jest.fn().mockResolvedValue(room);
  const memberFindUnique = jest.fn().mockResolvedValue(opts.membership);
  const ndaAcceptanceFindUnique = jest.fn().mockResolvedValue(opts.acceptance ?? null);

  const prisma = {
    dataRoom: { findFirst: dataRoomFindFirst },
    dataRoomMember: { findUnique: memberFindUnique },
    ndaAcceptance: { findUnique: ndaAcceptanceFindUnique },
  } as unknown as PrismaService;

  return { service: new DataRoomAccessService(prisma) };
}

// Regression coverage for the fix: assertMembership() must resolve for
// exactly the scenario that previously made NdaService.getStatus()/accept()
// circularly unreachable (NDA enabled, actor is a non-manager member, no
// acceptance yet) -- while getAccess(), the method every actual content
// endpoint still uses, must keep throwing for that same scenario. If these
// two ever started agreeing, either the NDA gate silently stopped being
// enforced for real content access, or the original bug came back.
describe('DataRoomAccessService.assertMembership vs getAccess (NDA circular-lockout fix)', () => {
  const NON_MANAGER_MEMBER = { roleOverride: null, canDownloadOriginal: false, removedAt: null };

  it('assertMembership() resolves for an unaccepted-NDA non-manager member (does not throw)', async () => {
    const { service } = buildNdaScenarioService({ membership: NON_MANAGER_MEMBER, acceptance: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    const access = await service.assertMembership('room-1', actor);

    expect(access.effectiveRole).toBe('PRA');
    expect(access.dataRoom.ndaEnabled).toBe(true);
  });

  it('getAccess() still throws the NDA message for that exact same scenario -- content access stays gated', async () => {
    const { service } = buildNdaScenarioService({ membership: NON_MANAGER_MEMBER, acceptance: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    await expect(service.getAccess('room-1', actor)).rejects.toThrow(
      'You must accept the confidentiality agreement before accessing this data room',
    );
  });

  it('getAccess() succeeds once an acceptance row exists, for the same membership', async () => {
    const { service } = buildNdaScenarioService({
      membership: NON_MANAGER_MEMBER,
      acceptance: { id: 'acc-1' },
    });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    const access = await service.getAccess('room-1', actor);

    expect(access.effectiveRole).toBe('PRA');
  });

  it('assertMembership() still rejects a removed/revoked membership (not bypassed by the fix)', async () => {
    const { service } = buildNdaScenarioService({
      membership: { ...NON_MANAGER_MEMBER, removedAt: new Date() },
    });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    await expect(service.assertMembership('room-1', actor)).rejects.toThrow(
      'You do not have access to this data room',
    );
  });

  it('assertMembership() still rejects a non-member entirely', async () => {
    const { service } = buildNdaScenarioService({ membership: null });
    const actor = { id: 'u1', organisationId: 'org-1', role: 'PRA' } as AuthenticatedUser;

    await expect(service.assertMembership('room-1', actor)).rejects.toThrow(
      'You do not have access to this data room',
    );
  });
});
