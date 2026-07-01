import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync as otpVerifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { generateOpaqueToken, sha256Hex } from '../../common/utils/crypto.util';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, AuthenticatedUser } from './types/jwt-payload.interface';

const BCRYPT_ROUNDS = 12;
const PASSWORD_HISTORY_LIMIT = 5;
const MFA_CHALLENGE_EXPIRY = '5m';
const APP_NAME = 'InsolvencyVDR';

export type LoginResult =
  | {
      requiresMfa: true;
      mfaChallengeToken: string;
    }
  | {
      requiresMfa?: false;
      accessToken: string;
      refreshToken: string;
      refreshExpiresAt: Date;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        organisationId: string;
      };
    };

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again after ${user.lockedUntil.toISOString()}`,
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active. Contact your administrator.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts, meta);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: meta.ipAddress,
      },
    });

    await this.enforceConcurrentSessionLimit(user.id);

    if (user.totpEnabled && user.totpSecret) {
      const mfaChallengeToken = this.jwtService.sign(
        { sub: user.id, mfaChallenge: true },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: MFA_CHALLENGE_EXPIRY,
        },
      );
      return { requiresMfa: true, mfaChallengeToken };
    }

    const { accessToken, refreshToken, refreshExpiresAt } = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.organisationId,
      Boolean(dto.rememberMe),
      meta,
    );

    await this.auditLogService.record({
      action: 'USER_LOGGED_IN',
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organisationId: user.organisationId,
      },
    };
  }

  async getMfaStatus(actor: AuthenticatedUser): Promise<{ totpEnabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { totpEnabled: true } });
    return { totpEnabled: user?.totpEnabled ?? false };
  }

  async setupMfa(actor: AuthenticatedUser): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { totpSecret: secret, totpEnabled: false },
    });

    const otpAuthUrl = generateURI({ issuer: APP_NAME, label: actor.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    return { qrCodeDataUrl, secret };
  }

  async verifyMfaSetup(actor: AuthenticatedUser, totpCode: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.totpSecret) {
      throw new BadRequestException('MFA setup has not been initiated. Call /auth/mfa/setup first.');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const result = otpVerifySync({ secret: user.totpSecret, token: totpCode });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({ where: { id: actor.id }, data: { totpEnabled: true } });

    await this.auditLogService.record({
      action: 'MFA_ENABLED',
      userId: actor.id,
    });
  }

  async disableMfa(actor: AuthenticatedUser, totpCode: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const result = otpVerifySync({ secret: user.totpSecret, token: totpCode });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: actor.id },
      data: { totpEnabled: false, totpSecret: null },
    });

    await this.auditLogService.record({
      action: 'MFA_DISABLED',
      userId: actor.id,
    });
  }

  async verifyMfaLogin(
    mfaChallengeToken: string,
    totpCode: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date; user: { id: string; email: string; firstName: string; lastName: string; role: string; organisationId: string } }> {
    let payload: { sub: string; mfaChallenge?: boolean };
    try {
      payload = this.jwtService.verify(mfaChallengeToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge token');
    }

    if (!payload.mfaChallenge) {
      throw new UnauthorizedException('Invalid MFA challenge token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('MFA is not configured for this account');
    }

    const result = otpVerifySync({ secret: user.totpSecret, token: totpCode });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: meta.ipAddress },
    });

    const { accessToken, refreshToken, refreshExpiresAt } = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.organisationId,
      rememberMe,
      meta,
    );

    await this.auditLogService.record({
      action: 'USER_LOGGED_IN',
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organisationId: user.organisationId,
      },
    };
  }

  async logout(refreshTokenRaw: string | undefined, userId: string | undefined): Promise<void> {
    if (refreshTokenRaw) {
      const tokenHash = sha256Hex(refreshTokenRaw);
      await this.prisma.session.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (userId) {
      await this.auditLogService.record({ action: 'USER_LOGGED_OUT', userId });
    }
  }

  async refresh(refreshTokenRaw: string, meta: RequestMeta) {
    const tokenHash = sha256Hex(refreshTokenRaw);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (session.user.deletedAt || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Rotate: revoke the old session, issue a brand new one.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken, refreshExpiresAt } = await this.issueTokens(
      session.user.id,
      session.user.email,
      session.user.role,
      session.user.organisationId,
      session.rememberMe,
      meta,
    );

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always behave the same way whether or not the email exists, so this
    // endpoint can't be used to enumerate registered accounts.
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      return;
    }

    const { raw, hash } = generateOpaqueToken();
    const expiresMinutes = this.configService.get<number>('jwt.passwordResetExpiresMinutes')!;

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + expiresMinutes * 60_000),
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const resetUrl = `${frontendUrl}/reset-password?token=${raw}`;

    await this.mailService.sendPasswordResetEmail(user.email, resetUrl, expiresMinutes, { userId: user.id });
    await this.auditLogService.record({ action: 'USER_PASSWORD_RESET_REQUESTED', userId: user.id });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const user = resetToken.user;
    const previousHashes = (user.previousPasswords as string[]) ?? [];

    for (const oldHash of [user.password, ...previousHashes]) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        throw new BadRequestException('You cannot reuse a recent password');
      }
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updatedHistory = [user.password, ...previousHashes].slice(0, PASSWORD_HISTORY_LIMIT);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: newHash,
          previousPasswords: updatedHistory,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Reset password invalidates all existing sessions.
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLogService.record({ action: 'USER_PASSWORD_RESET_COMPLETED', userId: user.id });
  }

  async acceptInvite(token: string, password: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const inviteToken = await this.prisma.inviteToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!inviteToken || inviteToken.acceptedAt || inviteToken.expiresAt < new Date()) {
      throw new BadRequestException('Invite link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: inviteToken.userId },
        data: { password: passwordHash, status: 'ACTIVE' },
      }),
      this.prisma.inviteToken.update({
        where: { id: inviteToken.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    await this.auditLogService.record({
      action: 'USER_INVITE_ACCEPTED',
      userId: inviteToken.userId,
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    await this.mailService.sendWelcomeEmail(
      inviteToken.user.email,
      inviteToken.user.firstName,
      `${frontendUrl}/login`,
      { userId: inviteToken.userId },
    );
  }

  private async handleFailedLogin(
    userId: string,
    currentAttempts: number,
    meta: RequestMeta,
  ): Promise<void> {
    const maxAttempts = this.configService.get<number>('jwt.maxLoginAttempts')!;
    const lockMinutes = this.configService.get<number>('jwt.accountLockMinutes')!;
    const attempts = currentAttempts + 1;
    const willLock = attempts >= maxAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: willLock ? new Date(Date.now() + lockMinutes * 60_000) : undefined,
      },
    });

    await this.auditLogService.record({
      action: willLock ? 'USER_ACCOUNT_LOCKED' : 'USER_LOGIN_FAILED',
      userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    const maxSessions = this.configService.get<number>('jwt.maxConcurrentSessions')!;
    const activeSessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    });

    if (activeSessions.length >= maxSessions) {
      const excess = activeSessions.slice(0, activeSessions.length - maxSessions + 1);
      await this.prisma.session.updateMany({
        where: { id: { in: excess.map((s) => s.id) } },
        data: { revokedAt: new Date() },
      });
    }
  }

  async issueTokensForUser(userId: string, email: string, role: string, organisationId: string) {
    return this.issueTokens(userId, email, role, organisationId, true, { userAgent: '', ipAddress: '' });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    organisationId: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ) {
    const payload: JwtPayload = { sub: userId, email, role: role as JwtPayload['role'], organisationId };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });

    const { raw: refreshToken, hash: refreshTokenHash } = generateOpaqueToken();
    const days = rememberMe
      ? this.configService.get<number>('jwt.refreshRememberMeExpiresDays')!
      : this.configService.get<number>('jwt.refreshExpiresDays')!;
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60_000);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        rememberMe,
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }
}
