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
}));
