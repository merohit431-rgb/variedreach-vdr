import { registerAs } from '@nestjs/config';

// Mirrors payment.config.ts's shape (a `provider` discriminator defaulting
// to a safe no-op), but NOT its production validation policy -- staying on
// 'mock' is the permanently-supported, approved default here, not a
// stopgap. Only an explicit 'external' with a missing key fails production
// boot; see validate-production-env.ts.
export default registerAs('ranking', () => ({
  provider: process.env.RANKING_PROVIDER || 'mock',
  externalApiKey: process.env.RANKING_EXTERNAL_API_KEY || '',
}));
