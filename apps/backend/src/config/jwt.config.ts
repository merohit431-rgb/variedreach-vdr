import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production-32-chars',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10),
  refreshRememberMeExpiresDays: parseInt(
    process.env.JWT_REFRESH_REMEMBER_ME_EXPIRES_DAYS || '30',
    10,
  ),
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  accountLockMinutes: parseInt(process.env.ACCOUNT_LOCK_MINUTES || '30', 10),
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3', 10),
  passwordResetExpiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '60', 10),
  inviteExpiresHours: parseInt(process.env.INVITE_EXPIRES_HOURS || '72', 10),
  registrationVerificationExpiresHours: parseInt(
    process.env.REGISTRATION_VERIFICATION_EXPIRES_HOURS || '24',
    10,
  ),
}));
