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
