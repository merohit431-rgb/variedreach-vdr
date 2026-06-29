import { registerAs } from '@nestjs/config';

export default registerAs('conversion', () => ({
  gotenbergUrl: process.env.GOTENBERG_URL || 'http://gotenberg:3000',
  timeoutMs: parseInt(process.env.GOTENBERG_TIMEOUT_MS || '30000', 10),
}));
