import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  url: process.env.APP_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  throttle: {
    // Limits for the 'global' named throttler (applied to all endpoints).
    // Auth/registration endpoints are tightened individually via hardcoded
    // @Throttle() literals directly on each route (auth.controller.ts,
    // registration.controller.ts) -- not env-driven. This file used to also
    // define authTtl/authLimit/registrationTtl/registrationLimit, but
    // nothing in src/ ever read them; worse, THROTTLE_AUTH_LIMIT looked like
    // it raised the login limit from the hardcoded 5 while silently doing
    // nothing. Removed rather than wired up, since @Throttle()'s decorator
    // arguments are fixed at class-definition time (before ConfigService
    // exists) -- making them env-driven would need a custom guard, out of
    // scope for what was just a dead/misleading config cleanup.
    globalTtl: parseInt(process.env.THROTTLE_GLOBAL_TTL || '60', 10),     // seconds
    globalLimit: parseInt(process.env.THROTTLE_GLOBAL_LIMIT || '300', 10), // requests per TTL
  },
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  storageMaxFileSizeBytes: parseInt(process.env.STORAGE_MAX_FILE_SIZE_BYTES || `${2 * 1024 * 1024 * 1024}`, 10),
}));
