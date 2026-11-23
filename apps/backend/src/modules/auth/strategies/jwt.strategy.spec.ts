import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { AuditLogService } from '../../audit/audit-log.service';

// Phase 3B.2 Step 4: this is the "existing session" re-check -- it runs on
// every single authenticated request, independent of anything else in this
// phase, and was already correct before this phase (confirmed by direct
// code review of the PRE-existing checks here). These tests exist to prove
// that and to cover the new audit calls added alongside it, not because the
// rejection logic itself changed.
function buildStrategy(opts: { user?: Record<string, unknown> | null; membership?: Record<string, unknown> | null }) {
  const record = jest.fn().mockResolvedValue({});
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue('user' in opts ? opts.user : { id: 'user-1', role: 'PRA', status: 'ACTIVE', deletedAt: null }) },
    organisationMembership: {
      findUnique: jest.fn().mockResolvedValue('membership' in opts ? opts.membership : { status: 'ACTIVE', role: 'PRA', organisationId: 'org-1', organisation: { status: 'ACTIVE', deletedAt: null, subscription: null } }),
    },
  } as unknown as PrismaService;
  const configService = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
  const strategy = new JwtStrategy(configService, prisma, { record } as unknown as AuditLogService);
  return { strategy, record };
}

const PAYLOAD = { sub: 'user-1', email: 'x@y.com', role: 'PRA', organisationId: 'org-1' };

describe('JwtStrategy.validate', () => {
  it('accepts a request for an ACTIVE user with an ACTIVE membership', async () => {
    const { strategy } = buildStrategy({});
    const result = await strategy.validate(PAYLOAD as any);
    expect(result.id).toBe('user-1');
    expect(result.role).toBe('PRA');
  });

  it('SUPER_ADMIN bypasses the membership check entirely (org-agnostic)', async () => {
    const { strategy } = buildStrategy({ user: { id: 'super-1', role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null, organisationId: 'any-org', email: 'a@b.com', firstName: 'A', lastName: 'B' } });
    const result = await strategy.validate({ ...PAYLOAD, sub: 'super-1' } as any);
    expect(result.role).toBe('SUPER_ADMIN');
  });

  it('rejects a SUSPENDED user-level account and records an audit event', async () => {
    const { strategy, record } = buildStrategy({ user: { id: 'user-1', role: 'PRA', status: 'SUSPENDED', deletedAt: null } });

    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow(UnauthorizedException);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED_SUSPENDED', userId: 'user-1', metadata: expect.objectContaining({ stage: 'session_validation', level: 'user' }) }),
    );
  });

  it('rejects a non-existent (or hard-deleted) user WITHOUT recording a suspension audit event', async () => {
    const { strategy, record } = buildStrategy({ user: null });

    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow(UnauthorizedException);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects a soft-deleted user WITHOUT recording a suspension audit event (not a suspension)', async () => {
    const { strategy, record } = buildStrategy({ user: { id: 'user-1', role: 'PRA', status: 'ACTIVE', deletedAt: new Date() } });

    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow(UnauthorizedException);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects a SUSPENDED membership for an otherwise-ACTIVE user and records an audit event', async () => {
    const { strategy, record } = buildStrategy({
      membership: { status: 'SUSPENDED', role: 'PRA', organisationId: 'org-1', organisation: { status: 'ACTIVE', deletedAt: null, subscription: null } },
    });

    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow('Session is no longer valid');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED_SUSPENDED', userId: 'user-1', organisationId: 'org-1', metadata: expect.objectContaining({ stage: 'session_validation', level: 'membership' }) }),
    );
  });

  it('rejects when the membership was removed entirely', async () => {
    const { strategy } = buildStrategy({ membership: null });
    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow('Session is no longer valid');
  });

  it('rejects when the organisation itself is suspended, distinct from a membership/user suspension', async () => {
    const { strategy } = buildStrategy({
      membership: { status: 'ACTIVE', role: 'PRA', organisationId: 'org-1', organisation: { status: 'SUSPENDED', deletedAt: null, subscription: null } },
    });
    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow('This organisation is not currently active');
  });

  it('a failure to write the audit record never blocks the actual rejection', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: 'PRA', status: 'SUSPENDED', deletedAt: null }) },
      organisationMembership: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const configService = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
    const auditLogService = { record: jest.fn().mockRejectedValue(new Error('DB blip')) } as unknown as AuditLogService;
    const strategy = new JwtStrategy(configService, prisma, auditLogService);

    await expect(strategy.validate(PAYLOAD as any)).rejects.toThrow(UnauthorizedException);
  });
});
