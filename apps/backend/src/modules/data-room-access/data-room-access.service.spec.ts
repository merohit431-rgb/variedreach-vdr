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
