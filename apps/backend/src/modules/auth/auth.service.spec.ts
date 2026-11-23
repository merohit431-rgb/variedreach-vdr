import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { AuditLogService } from '../audit/audit-log.service';
import type { MailService } from '../mail/mail.service';

// These tests intentionally stop at the "user not found" branch (findUnique
// resolves null) -- that's enough to prove the query itself was normalized,
// without needing to mock the rest of login()'s bcrypt/MFA/session machinery.
function buildService(userFindUnique: jest.Mock) {
  const prisma = { user: { findUnique: userFindUnique } } as unknown as PrismaService;
  return new AuthService(
    prisma,
    {} as JwtService,
    {} as ConfigService,
    {} as AuditLogService,
    {} as MailService,
  );
}

describe('AuthService email normalization', () => {
  it('login() normalizes a mixed-case, padded email before querying', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = buildService(findUnique);

    await expect(
      service.login(
        { email: '  Manthan.Jhaveri@CrawfordBayley.com  ', password: 'whatever' } as any,
        {} as any,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'manthan.jhaveri@crawfordbayley.com' } });
  });

  it('forgotPassword() normalizes a mixed-case, padded email before querying', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = buildService(findUnique);

    await service.forgotPassword('  Manthan.Jhaveri@CrawfordBayley.com  ');

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'manthan.jhaveri@crawfordbayley.com' } });
  });
});

describe('AuthService organisation-status enforcement', () => {
  const actor = { id: 'user-1', email: 'x@y.com', role: 'PRA', organisationId: 'org-1', firstName: 'X', lastName: 'Y' } as any;

  function buildServiceWithMembership(membershipFindUnique: jest.Mock) {
    const prisma = { organisationMembership: { findUnique: membershipFindUnique } } as unknown as PrismaService;
    return new AuthService(prisma, {} as JwtService, {} as ConfigService, {} as AuditLogService, {} as MailService);
  }

  it('switchWorkspace() rejects a target organisation that is SUSPENDED, before issuing any token', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      role: 'PRA',
      organisationId: 'org-2',
      status: 'ACTIVE',
      organisation: { status: 'SUSPENDED', deletedAt: null },
    });
    const service = buildServiceWithMembership(findUnique);

    await expect(service.switchWorkspace(actor, 'org-2', {} as any)).rejects.toThrow(
      'This organisation is not currently active',
    );
  });

  it('switchWorkspace() rejects a target organisation that is soft-deleted', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      role: 'PRA',
      organisationId: 'org-2',
      status: 'ACTIVE',
      organisation: { status: 'ACTIVE', deletedAt: new Date() },
    });
    const service = buildServiceWithMembership(findUnique);

    await expect(service.switchWorkspace(actor, 'org-2', {} as any)).rejects.toThrow(
      'This organisation is not currently active',
    );
  });

  it('switchWorkspace() still rejects an inactive membership before even checking the organisation', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = buildServiceWithMembership(findUnique);

    await expect(service.switchWorkspace(actor, 'org-2', {} as any)).rejects.toThrow(
      'You are not a member of that organisation',
    );
  });
});

// Phase 3B.2: login() used to query organisationMembership with
// `status: 'ACTIVE'` built into the WHERE clause, so "this user has a
// membership, but it's SUSPENDED" and "this user has never had a membership
// row at all" produced the identical empty result -- and the empty-result
// case intentionally falls through to a legacy-columns path (for the brief
// pre-migration-backfill window). That meant a suspended membership silently
// let login() proceed anyway, found via Phase 3B.1's live testing. These
// tests exercise the real login() entry point (not a private method), with
// the PASSWORD_PLAINTEXT/PASSWORD_HASH pair below providing a real bcrypt
// round-trip -- password verification itself is never mocked away.
describe('AuthService -- individual membership suspension (Phase 3B.2)', () => {
  const PASSWORD_PLAINTEXT = 'CorrectHorseBatteryStaple1!';
  const PASSWORD_HASH = '$2a$12$fqcA9BktYWvpyl5Zi.Q.s.11hSepTRcH9KKS3wl/qe1HZihtGsJpu';

  const BASE_USER = {
    id: 'user-1',
    email: 'pra@example.com',
    firstName: 'P',
    lastName: 'R',
    role: 'PRA', // not in MANDATORY_MFA_ROLES, and emailOtpEnabled is false below -- no MFA challenge in the way
    organisationId: 'legacy-org-id',
    password: PASSWORD_HASH,
    status: 'ACTIVE',
    deletedAt: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    emailOtpEnabled: false,
    totpEnabled: false,
    totpSecret: null,
  };

  const CONFIG_DEFAULTS: Record<string, number> = {
    'jwt.maxLoginAttempts': 5,
    'jwt.accountLockMinutes': 15,
    // Reached only by the tests that get past the membership block -- the
    // sentinel on session.findMany fires on the very next line after this
    // read, so a real-looking value is enough; its own session.findMany
    // call is what actually throws.
    'jwt.maxConcurrentSessions': 3,
  };

  function buildLoginService(membershipFindMany: jest.Mock, sessionFindMany?: jest.Mock) {
    const userFindUnique = jest.fn().mockResolvedValue(BASE_USER);
    const userUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      user: { findUnique: userFindUnique, update: userUpdate },
      organisationMembership: { findMany: membershipFindMany },
      trustedDevice: { findUnique: jest.fn().mockResolvedValue(null) },
      session: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-session' }), // isUnrecognizedDevice: false, skips the login-alert email path
        findMany: sessionFindMany ?? jest.fn().mockRejectedValue(new Error('SENTINEL: reached enforceConcurrentSessionLimit')),
      },
    } as unknown as PrismaService;
    const configService = { get: jest.fn((key: string) => CONFIG_DEFAULTS[key]) } as unknown as ConfigService;
    return new AuthService(prisma, {} as JwtService, configService, { record: jest.fn() } as unknown as AuditLogService, {} as MailService);
  }

  it('rejects login when the user\'s only membership is SUSPENDED', async () => {
    const membershipFindMany = jest.fn().mockResolvedValue([
      { organisationId: 'org-1', role: 'PRA', status: 'SUSPENDED', organisation: { status: 'ACTIVE', deletedAt: null, name: 'Org 1', subscription: null } },
    ]);
    const service = buildLoginService(membershipFindMany);

    await expect(service.login({ email: BASE_USER.email, password: PASSWORD_PLAINTEXT } as any, {} as any)).rejects.toThrow(
      'Account is not active. Contact your administrator.',
    );
  });

  it('rejects login when EVERY membership the user has is SUSPENDED (multi-org case)', async () => {
    const membershipFindMany = jest.fn().mockResolvedValue([
      { organisationId: 'org-1', role: 'PRA', status: 'SUSPENDED', organisation: { status: 'ACTIVE', deletedAt: null, name: 'Org 1', subscription: null } },
      { organisationId: 'org-2', role: 'COC_MEMBER', status: 'SUSPENDED', organisation: { status: 'ACTIVE', deletedAt: null, name: 'Org 2', subscription: null } },
    ]);
    const service = buildLoginService(membershipFindMany);

    await expect(service.login({ email: BASE_USER.email, password: PASSWORD_PLAINTEXT } as any, {} as any)).rejects.toThrow(
      'Account is not active. Contact your administrator.',
    );
  });

  it('still allows login when at least one of several memberships is ACTIVE, even if another is SUSPENDED', async () => {
    const membershipFindMany = jest.fn().mockResolvedValue([
      { organisationId: 'org-1', role: 'PRA', status: 'SUSPENDED', organisation: { status: 'ACTIVE', deletedAt: null, name: 'Org 1', subscription: null } },
      { organisationId: 'org-2', role: 'COC_MEMBER', status: 'ACTIVE', organisation: { status: 'ACTIVE', deletedAt: null, name: 'Org 2', subscription: null } },
    ]);
    const service = buildLoginService(membershipFindMany);

    // Reaches past the membership block entirely (exactly one ACTIVE,
    // valid membership resolves it) and hits the sentinel at the next real
    // step -- proving this case was never rejected as "suspended".
    await expect(service.login({ email: BASE_USER.email, password: PASSWORD_PLAINTEXT } as any, {} as any)).rejects.toThrow(
      'SENTINEL: reached enforceConcurrentSessionLimit',
    );
  });

  it('REGRESSION: a user with a single ACTIVE membership still logs in normally, unaffected by this fix', async () => {
    const membershipFindMany = jest.fn().mockResolvedValue([
      { organisationId: 'org-1', role: 'PRA', status: 'ACTIVE', organisation: { status: 'ACTIVE', deletedAt: null, name: 'Org 1', subscription: null } },
    ]);
    const service = buildLoginService(membershipFindMany);

    await expect(service.login({ email: BASE_USER.email, password: PASSWORD_PLAINTEXT } as any, {} as any)).rejects.toThrow(
      'SENTINEL: reached enforceConcurrentSessionLimit',
    );
  });

  it('rejects a user-level SUSPENDED account with the CORRECT password -- checked after password verification, not before', async () => {
    const membershipFindMany = jest.fn();
    const userFindUnique = jest.fn().mockResolvedValue({ ...BASE_USER, status: 'SUSPENDED' });
    const record = jest.fn();
    const prisma = {
      user: { findUnique: userFindUnique, update: jest.fn() },
      organisationMembership: { findMany: membershipFindMany },
      trustedDevice: { findUnique: jest.fn().mockResolvedValue(null) },
      session: { findFirst: jest.fn(), findMany: jest.fn() },
    } as unknown as PrismaService;
    const configService = { get: jest.fn((key: string) => CONFIG_DEFAULTS[key]) } as unknown as ConfigService;
    const service = new AuthService(prisma, {} as JwtService, configService, { record } as unknown as AuditLogService, {} as MailService);

    await expect(service.login({ email: BASE_USER.email, password: PASSWORD_PLAINTEXT } as any, { ipAddress: '1.2.3.4' } as any)).rejects.toThrow(
      'Account is not active. Contact your administrator.',
    );
    // Never even reaches the membership query -- rejected at the user level first.
    expect(membershipFindMany).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED_SUSPENDED', metadata: expect.objectContaining({ stage: 'login', level: 'user' }) }),
    );
  });

  it('REGRESSION: a user with zero membership rows ever still falls through to the legacy-columns path, unaffected by this fix', async () => {
    const membershipFindMany = jest.fn().mockResolvedValue([]);
    const service = buildLoginService(membershipFindMany);

    await expect(service.login({ email: BASE_USER.email, password: PASSWORD_PLAINTEXT } as any, {} as any)).rejects.toThrow(
      'SENTINEL: reached enforceConcurrentSessionLimit',
    );
  });

  it('rejects an incorrect password before ever reaching the membership check', async () => {
    const membershipFindMany = jest.fn();
    const service = buildLoginService(membershipFindMany);

    await expect(service.login({ email: BASE_USER.email, password: 'wrong-password' } as any, {} as any)).rejects.toThrow(
      'Invalid email or password',
    );
    expect(membershipFindMany).not.toHaveBeenCalled();
  });
});

// Phase 3B.2: the dormant TOTP MFA path (verifyMfaLogin) didn't re-check
// account status at verification time, unlike the actually-used email-OTP
// path -- a real gap if the account was suspended in the minutes between
// login() minting the challenge token and the user submitting their code.
describe('AuthService.verifyMfaLogin -- account-status re-check (Phase 3B.2)', () => {
  function buildMfaService(user: Record<string, unknown> | null) {
    const jwtVerify = jest.fn().mockReturnValue({ sub: 'user-1', mfaChallenge: true });
    const jwtService = { verify: jwtVerify } as unknown as JwtService;
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } } as unknown as PrismaService;
    const configService = { get: jest.fn() } as unknown as ConfigService;
    return new AuthService(prisma, jwtService, configService, { record: jest.fn() } as unknown as AuditLogService, {} as MailService);
  }

  it('rejects a valid TOTP code for an account suspended after the challenge was issued', async () => {
    const service = buildMfaService({
      id: 'user-1',
      totpEnabled: true,
      totpSecret: 'PSNSODY3QXYLNSM52EPB42QYXPALWUJZ',
      status: 'SUSPENDED',
      deletedAt: null,
    });

    await expect(service.verifyMfaLogin('challenge-token', '123456', false, {} as any)).rejects.toThrow(
      'Account is not active. Contact your administrator.',
    );
  });

  it('rejects for a soft-deleted account even with totpEnabled still set', async () => {
    const service = buildMfaService({
      id: 'user-1',
      totpEnabled: true,
      totpSecret: 'PSNSODY3QXYLNSM52EPB42QYXPALWUJZ',
      status: 'ACTIVE',
      deletedAt: new Date(),
    });

    await expect(service.verifyMfaLogin('challenge-token', '123456', false, {} as any)).rejects.toThrow(
      'Account is not active. Contact your administrator.',
    );
  });

  it('still reaches real TOTP verification (and rejects an invalid code) for an ACTIVE account', async () => {
    const service = buildMfaService({
      id: 'user-1',
      totpEnabled: true,
      totpSecret: 'PSNSODY3QXYLNSM52EPB42QYXPALWUJZ',
      status: 'ACTIVE',
      deletedAt: null,
    });

    // A code that is certainly wrong against this secret -- proving we got
    // PAST the new status check and into the real otplib verification,
    // rather than the status check masking everything downstream.
    await expect(service.verifyMfaLogin('challenge-token', '000000', false, {} as any)).rejects.toThrow('Invalid TOTP code');
  });
});

// Phase 3B.2 Step 3: refresh() already independently re-checked both
// user-level and membership-level status before this phase (confirmed by
// direct code review) -- these tests close the gap of there being no
// regression coverage for that existing behaviour, and confirm the new
// audit calls fire on each denial path.
describe('AuthService.refresh -- suspension re-check (Phase 3B.2)', () => {
  const ACTIVE_SESSION_USER = {
    id: 'user-1',
    role: 'PRA',
    organisationId: 'org-1',
    status: 'ACTIVE',
    deletedAt: null,
  };

  function buildRefreshService(session: Record<string, unknown> | null, membership?: Record<string, unknown> | null) {
    const record = jest.fn();
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue(session),
        update: jest.fn(),
      },
      organisationMembership: {
        findUnique: membership === undefined ? jest.fn() : jest.fn().mockResolvedValue(membership),
      },
    } as unknown as PrismaService;
    const service = new AuthService(prisma, {} as JwtService, {} as ConfigService, { record } as unknown as AuditLogService, {} as MailService);
    return { service, record };
  }

  it('rejects refresh for a user-level SUSPENDED account, with an audit record', async () => {
    const { service, record } = buildRefreshService({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100_000),
      organisationId: 'org-1',
      user: { ...ACTIVE_SESSION_USER, status: 'SUSPENDED' },
    });

    await expect(service.refresh('raw-token', { ipAddress: '1.2.3.4' } as any)).rejects.toThrow('Account is not active');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED_SUSPENDED', metadata: expect.objectContaining({ stage: 'refresh', level: 'user' }) }),
    );
  });

  it('rejects refresh when the session\'s scoped membership is SUSPENDED, with an audit record', async () => {
    const { service, record } = buildRefreshService(
      {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
        organisationId: 'org-1',
        user: ACTIVE_SESSION_USER,
      },
      { status: 'SUSPENDED', role: 'PRA', organisationId: 'org-1', organisation: { status: 'ACTIVE', deletedAt: null, subscription: null } },
    );

    await expect(service.refresh('raw-token', {} as any)).rejects.toThrow('Session is no longer valid');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED_SUSPENDED', metadata: expect.objectContaining({ stage: 'refresh', level: 'membership' }) }),
    );
  });

  it('rejects refresh when the membership was removed entirely (not just suspended)', async () => {
    const { service } = buildRefreshService(
      {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
        organisationId: 'org-1',
        user: ACTIVE_SESSION_USER,
      },
      null,
    );

    await expect(service.refresh('raw-token', {} as any)).rejects.toThrow('Session is no longer valid');
  });

  it('rejects an already-revoked session before any status check', async () => {
    const { service } = buildRefreshService({
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 100_000),
      organisationId: 'org-1',
      user: ACTIVE_SESSION_USER,
    });

    await expect(service.refresh('raw-token', {} as any)).rejects.toThrow('Refresh token is invalid or expired');
  });
});
