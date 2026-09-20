import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgMembersService } from './org-members.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const ORG_ID = 'org-1';

function actor(role: UserRole, organisationId = ORG_ID, id = 'actor-1'): AuthenticatedUser {
  return { id, email: 'actor@test.com', role, organisationId, firstName: 'A', lastName: 'Actor' };
}

function buildService(overrides: {
  organisation?: unknown;
  membership?: unknown;
  update?: jest.Mock;
  record?: jest.Mock;
}) {
  const record = overrides.record ?? jest.fn().mockResolvedValue({});
  const update = overrides.update ?? jest.fn();
  const prisma = {
    organisation: { findUnique: jest.fn().mockResolvedValue(overrides.organisation ?? { id: ORG_ID }) },
    organisationMembership: {
      findUnique: jest.fn().mockResolvedValue(overrides.membership ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      update,
    },
  } as unknown as PrismaService;
  const auditLogService = { record } as unknown as AuditLogService;
  return { service: new OrgMembersService(prisma, auditLogService), prisma, record, update };
}

describe('OrgMembersService.updateMemberStatus authorization', () => {
  it('blocks an Org Admin from a different organisation entirely', async () => {
    const { service } = buildService({});
    await expect(
      service.updateMemberStatus('other-org', 'target-1', 'SUSPENDED', actor(UserRole.ORG_ADMIN)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks self-suspension regardless of role', async () => {
    const { service } = buildService({});
    await expect(
      service.updateMemberStatus(ORG_ID, 'actor-1', 'SUSPENDED', actor(UserRole.ORG_ADMIN)),
    ).rejects.toThrow('You cannot change your own account status');
  });

  it('404s when the target has no membership in this org', async () => {
    const { service } = buildService({ membership: null });
    await expect(
      service.updateMemberStatus(ORG_ID, 'target-1', 'SUSPENDED', actor(UserRole.ORG_ADMIN)),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks an Org Admin from suspending the organisation owner', async () => {
    const { service } = buildService({
      membership: { userId: 'target-1', organisationId: ORG_ID, role: UserRole.PRA, isOwner: true, status: 'ACTIVE' },
    });
    await expect(
      service.updateMemberStatus(ORG_ID, 'target-1', 'SUSPENDED', actor(UserRole.ORG_ADMIN)),
    ).rejects.toThrow("You cannot change the organisation owner's account status");
  });

  it('allows a Super Admin to suspend the organisation owner', async () => {
    const update = jest.fn().mockResolvedValue({ status: 'SUSPENDED' });
    const { service, record } = buildService({
      membership: { userId: 'target-1', organisationId: ORG_ID, role: UserRole.ORG_ADMIN, isOwner: true, status: 'ACTIVE' },
      update,
    });
    await service.updateMemberStatus(ORG_ID, 'target-1', 'SUSPENDED', actor(UserRole.SUPER_ADMIN, 'irrelevant-org'));
    expect(update).toHaveBeenCalledWith({
      where: { userId_organisationId: { userId: 'target-1', organisationId: ORG_ID } },
      data: { status: 'SUSPENDED' },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_SUSPENDED', resourceType: 'User', resourceId: 'target-1' }),
    );
  });

  it('blocks an Org Admin from suspending a member who outranks them (e.g. a co-Org-Admin cannot be blocked via rank alone, but a hypothetically higher rank is)', async () => {
    // RP_LIQUIDATOR (80) attempting to act via this endpoint would already be
    // rejected by assertOrgAccess (org-wide tier is Org Admin/Super Admin
    // only) -- this exercises the rank check specifically using a same-tier
    // actor against a membership row whose role outranks them, which
    // shouldn't occur in practice but must still be rejected defensively.
    const { service } = buildService({
      membership: { userId: 'target-1', organisationId: ORG_ID, role: UserRole.SUPER_ADMIN, isOwner: false, status: 'ACTIVE' },
    });
    await expect(
      service.updateMemberStatus(ORG_ID, 'target-1', 'SUSPENDED', actor(UserRole.ORG_ADMIN)),
    ).rejects.toThrow('You cannot change the status of a member who outranks you');
  });

  it('is a no-op (no write, no audit entry) when the status already matches', async () => {
    const { service, update, record } = buildService({
      membership: { userId: 'target-1', organisationId: ORG_ID, role: UserRole.PRA, isOwner: false, status: 'SUSPENDED' },
    });
    const result = await service.updateMemberStatus(ORG_ID, 'target-1', 'SUSPENDED', actor(UserRole.ORG_ADMIN));
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ status: 'SUSPENDED' }));
  });

  it('reactivates and audit-logs USER_REACTIVATED', async () => {
    const update = jest.fn().mockResolvedValue({ status: 'ACTIVE' });
    const { service, record } = buildService({
      membership: { userId: 'target-1', organisationId: ORG_ID, role: UserRole.PRA, isOwner: false, status: 'SUSPENDED' },
      update,
    });
    await service.updateMemberStatus(ORG_ID, 'target-1', 'ACTIVE', actor(UserRole.ORG_ADMIN));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_REACTIVATED' }));
  });
});
