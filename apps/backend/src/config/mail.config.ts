import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  provider: process.env.MAIL_PROVIDER || 'nodemailer',
  host: process.env.MAIL_HOST || 'localhost',
  port: parseInt(process.env.MAIL_PORT || '1025', 10),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER || '',
  password: process.env.MAIL_PASSWORD || '',
  fromName: process.env.MAIL_FROM_NAME || 'Varied Reach',
  fromAddress: process.env.MAIL_FROM_ADDRESS || 'noreply@insolvencyvdr.local',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  // Prefixed onto every subject line when set -- e.g. "[STAGING] " -- so
  // staging mail is visually distinguishable in an inbox from production,
  // even though both send from the same noreply@vdr.variedreach.com.
  subjectPrefix: process.env.APP_ENVIRONMENT === 'staging' ? '[STAGING] ' : '',
}));
