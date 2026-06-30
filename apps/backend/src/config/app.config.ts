import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  url: process.env.APP_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '900000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '1000', 10),
    authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT || '20', 10),
  },
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  storageMaxFileSizeBytes: parseInt(process.env.STORAGE_MAX_FILE_SIZE_BYTES || `${2 * 1024 * 1024 * 1024}`, 10),
}));
