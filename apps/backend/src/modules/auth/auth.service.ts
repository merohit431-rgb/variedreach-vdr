import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
import { generateNumericOtp } from '../../common/utils/otp.util';
import { describeUserAgent } from '../../common/utils/device.util';
import { isMfaRequiredForUser, MANDATORY_MFA_ROLES } from '../../common/constants/mfa.constants';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, AuthenticatedUser } from './types/jwt-payload.interface';

const BCRYPT_ROUNDS = 12;
const PASSWORD_HISTORY_LIMIT = 5;
const MFA_CHALLENGE_EXPIRY = '10m';
const APP_NAME = 'InsolvencyVDR';

type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organisationId: string;
};

export type LoginResult =
  | {
      requiresMfa: true;
      mfaChallengeToken: string;
      mfaMethod: 'EMAIL_OTP' | 'TOTP';
    }
  | {
      requiresMfa?: false;
      accessToken: string;
      refreshToken: string;
      refreshExpiresAt: Date;
      user: PublicUser;
    };

export interface EmailOtpVerifyResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
  trustedDeviceToken?: string;
  trustedDeviceExpiresAt?: Date;
}

export interface SessionSummary {
  id: string;
  device: string;
  ipAddress: string | null;
  rememberMe: boolean;
  createdAt: Date;
  isCurrent: boolean;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  trustedDeviceToken?: string;
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
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

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

    // A recognized trusted-device cookie skips the OTP challenge entirely,
    // even for roles where MFA is otherwise mandatory -- that's the whole
    // point of "remember this device for 30 days".
    const trustedDevice = await this.matchTrustedDevice(user.id, meta.trustedDeviceToken);
    if (trustedDevice) {
      await this.prisma.trustedDevice.update({ where: { id: trustedDevice.id }, data: { lastUsedAt: new Date() } });
      return this.completeLogin(user, Boolean(dto.rememberMe), meta);
    }

    if (isMfaRequiredForUser(user)) {
      const mfaChallengeToken = await this.issueEmailOtpChallenge(user.id, user.email, Boolean(dto.rememberMe), meta);
      return { requiresMfa: true, mfaChallengeToken, mfaMethod: 'EMAIL_OTP' };
    }

    if (user.totpEnabled && user.totpSecret) {
      const mfaChallengeToken = this.jwtService.sign(
        { sub: user.id, mfaChallenge: true, method: 'TOTP' },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: MFA_CHALLENGE_EXPIRY,
        },
      );
      return { requiresMfa: true, mfaChallengeToken, mfaMethod: 'TOTP' };
    }

    return this.completeLogin(user, Boolean(dto.rememberMe), meta);
  }

  // Shared tail of every successful login (password-only, post-email-OTP, or
  // trusted-device skip): resets lockout counters, records lastLogin,
  // enforces the concurrent-session cap, issues tokens, audits, and -- if
  // this looks like a device we haven't seen before -- fires the login-alert
  // email. The "new device" check must run BEFORE issueTokens creates this
  // login's own session row, or it would always match itself.
  private async completeLogin(
    user: { id: string; email: string; firstName: string; lastName: string; role: string; organisationId: string },
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const isNewDevice = await this.isUnrecognizedDevice(user.id, meta);

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

    if (isNewDevice) {
      this.sendLoginAlert(user.id, user.email, user.firstName, meta).catch(() => undefined);
    }

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

  // Email OTP is the 2FA mechanism actually exposed in the product UI (see
  // MfaSettingsPanel); `required` tells the frontend whether to hide the
  // toggle and show a locked "required for your role" state instead.
  async getEmailOtpStatus(actor: AuthenticatedUser): Promise<{ enabled: boolean; required: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { emailOtpEnabled: true } });
    return { enabled: user?.emailOtpEnabled ?? false, required: MANDATORY_MFA_ROLES.includes(actor.role) };
  }

  async enableEmailOtp(actor: AuthenticatedUser): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { emailOtpEnabled: true } });
    if (user?.emailOtpEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    await this.prisma.user.update({ where: { id: actor.id }, data: { emailOtpEnabled: true } });
    await this.auditLogService.record({ action: 'MFA_ENABLED', userId: actor.id });
  }

  async disableEmailOtp(actor: AuthenticatedUser, currentPassword: string): Promise<void> {
    if (MANDATORY_MFA_ROLES.includes(actor.role)) {
      throw new BadRequestException("Two-factor authentication is required for your role and can't be disabled");
    }

    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.emailOtpEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.prisma.user.update({ where: { id: actor.id }, data: { emailOtpEnabled: false } });
    await this.auditLogService.record({ action: 'MFA_DISABLED', userId: actor.id });
  }

  async listSessions(actor: AuthenticatedUser, currentTokenHash: string | undefined): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId: actor.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      device: describeUserAgent(session.userAgent),
      ipAddress: session.ipAddress,
      rememberMe: session.rememberMe,
      createdAt: session.createdAt,
      isCurrent: Boolean(currentTokenHash) && session.tokenHash === currentTokenHash,
    }));
  }

  async revokeSession(actor: AuthenticatedUser, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== actor.id) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await this.auditLogService.record({ action: 'SESSION_REVOKED', userId: actor.id, resourceType: 'Session', resourceId: sessionId });
  }

  async revokeOtherSessions(actor: AuthenticatedUser, currentTokenHash: string | undefined): Promise<{ revoked: number }> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId: actor.id,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    if (result.count > 0) {
      await this.auditLogService.record({
        action: 'SESSION_REVOKED',
        userId: actor.id,
        metadata: { count: result.count, scope: 'all_other_devices' },
      });
    }
    return { revoked: result.count };
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

  private async verifyEmailOtpChallengeToken(mfaChallengeToken: string): Promise<string> {
    let payload: { sub: string; mfaChallenge?: boolean; method?: string };
    try {
      payload = this.jwtService.verify(mfaChallengeToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired code challenge. Please sign in again.');
    }
    if (!payload.mfaChallenge || payload.method !== 'EMAIL_OTP') {
      throw new UnauthorizedException('Invalid code challenge');
    }
    return payload.sub;
  }

  async verifyEmailOtpLogin(
    mfaChallengeToken: string,
    code: string,
    rememberMe: boolean,
    trustDevice: boolean,
    meta: RequestMeta,
  ): Promise<EmailOtpVerifyResult> {
    const userId = await this.verifyEmailOtpChallengeToken(mfaChallengeToken);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active. Contact your administrator.');
    }

    const challenge = await this.prisma.emailOtpChallenge.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new UnauthorizedException('This code has expired. Please request a new one.');
    }

    const maxAttempts = this.configService.get<number>('jwt.emailOtpMaxAttempts')!;
    if (challenge.attempts >= maxAttempts) {
      await this.prisma.emailOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw new UnauthorizedException('Too many incorrect attempts. Please request a new code.');
    }

    if (sha256Hex(code) !== challenge.codeHash) {
      const attempts = challenge.attempts + 1;
      await this.prisma.emailOtpChallenge.update({ where: { id: challenge.id }, data: { attempts } });
      await this.auditLogService.record({
        action: 'USER_LOGIN_FAILED',
        userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      const remaining = maxAttempts - attempts;
      throw new UnauthorizedException(
        remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Please request a new code.',
      );
    }

    await this.prisma.emailOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

    const loginResult = await this.completeLogin(user, rememberMe, meta);
    if (loginResult.requiresMfa) {
      // Unreachable in practice (completeLogin never returns the MFA branch)
      // but keeps the type system honest without an unsafe cast.
      throw new UnauthorizedException('Unexpected authentication state');
    }

    if (!trustDevice) {
      return loginResult;
    }

    const trustedDeviceDays = this.configService.get<number>('jwt.trustedDeviceDays')!;
    const { raw, hash } = generateOpaqueToken();
    const trustedDeviceExpiresAt = new Date(Date.now() + trustedDeviceDays * 24 * 60 * 60_000);

    await this.prisma.trustedDevice.create({
      data: {
        userId,
        tokenHash: hash,
        label: describeUserAgent(meta.userAgent),
        ipAddress: meta.ipAddress,
        expiresAt: trustedDeviceExpiresAt,
      },
    });
    await this.auditLogService.record({
      action: 'TRUSTED_DEVICE_ADDED',
      userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...loginResult, trustedDeviceToken: raw, trustedDeviceExpiresAt };
  }

  async resendEmailOtp(mfaChallengeToken: string, meta: RequestMeta): Promise<{ sent: true; mfaChallengeToken: string }> {
    const userId = await this.verifyEmailOtpChallengeToken(mfaChallengeToken);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active. Contact your administrator.');
    }

    const latest = await this.prisma.emailOtpChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const cooldownSeconds = this.configService.get<number>('jwt.emailOtpResendCooldownSeconds')!;
    if (latest) {
      const elapsedSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        throw new BadRequestException(`Please wait ${Math.ceil(cooldownSeconds - elapsedSeconds)}s before requesting another code`);
      }
    }

    const newChallengeToken = await this.issueEmailOtpChallenge(userId, user.email, latest?.rememberMe ?? false, meta);
    return { sent: true, mfaChallengeToken: newChallengeToken };
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

  async forgotPassword(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
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

  // Generates and emails a fresh 6-digit code, superseding any prior
  // unconsumed challenge for this user (a login retry or a resend must
  // invalidate the old code, not leave two simultaneously valid). Returns the
  // short-lived JWT the client carries through to the verify call — it names
  // the user and the method, never the code itself.
  private async issueEmailOtpChallenge(
    userId: string,
    email: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<string> {
    const code = generateNumericOtp(6);
    const expiryMinutes = this.configService.get<number>('jwt.emailOtpExpiryMinutes')!;

    await this.prisma.emailOtpChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.emailOtpChallenge.create({
      data: {
        userId,
        codeHash: sha256Hex(code),
        rememberMe,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + expiryMinutes * 60_000),
      },
    });

    await this.mailService.sendMfaOtpEmail(email, code, expiryMinutes, { userId });

    return this.jwtService.sign(
      { sub: userId, mfaChallenge: true, method: 'EMAIL_OTP' },
      { secret: this.configService.get<string>('jwt.accessSecret'), expiresIn: MFA_CHALLENGE_EXPIRY },
    );
  }

  private async matchTrustedDevice(userId: string, rawToken: string | undefined): Promise<{ id: string } | null> {
    if (!rawToken) return null;
    const device = await this.prisma.trustedDevice.findUnique({ where: { tokenHash: sha256Hex(rawToken) } });
    if (!device || device.userId !== userId || device.revokedAt || device.expiresAt < new Date()) return null;
    return { id: device.id };
  }

  // "New device" is approximated as: no currently-active session already
  // shares this exact IP + User-Agent pair. Cheap, no fingerprinting
  // dependency, and errs toward sending an alert rather than missing one.
  private async isUnrecognizedDevice(userId: string, meta: RequestMeta): Promise<boolean> {
    if (!meta.ipAddress && !meta.userAgent) return false;
    const existing = await this.prisma.session.findFirst({
      where: { userId, revokedAt: null, ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent ?? null },
      select: { id: true },
    });
    return !existing;
  }

  private async sendLoginAlert(userId: string, email: string, firstName: string, meta: RequestMeta): Promise<void> {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    await this.mailService.sendLoginAlertEmail(
      email,
      firstName,
      describeUserAgent(meta.userAgent),
      meta.ipAddress || 'Unknown',
      new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      `${frontendUrl}/settings`,
      { userId },
    );
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
