import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  url: process.env.APP_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  throttle: {
    // Limits for the 'global' named throttler (applied to all endpoints)
    globalTtl: parseInt(process.env.THROTTLE_GLOBAL_TTL || '60', 10),     // seconds
    globalLimit: parseInt(process.env.THROTTLE_GLOBAL_LIMIT || '300', 10), // requests per TTL
    // Tighter limits applied individually to auth endpoints via @Throttle()
    authTtl: parseInt(process.env.THROTTLE_AUTH_TTL || '900', 10),         // 15 minutes
    authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT || '5', 10),       // 5 per 15 min
    // Registration endpoints
    registrationTtl: parseInt(process.env.THROTTLE_REGISTRATION_TTL || '3600', 10), // 1 hour
    registrationLimit: parseInt(process.env.THROTTLE_REGISTRATION_LIMIT || '10', 10),
  },
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  storageMaxFileSizeBytes: parseInt(process.env.STORAGE_MAX_FILE_SIZE_BYTES || `${100 * 1024 * 1024}`, 10),
}));
