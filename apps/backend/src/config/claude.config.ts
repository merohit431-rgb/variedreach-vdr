import { registerAs } from '@nestjs/config';

// Mirrors ranking.config.ts's shape (a safe-by-default discriminator), but
// here the "off" state isn't a provider choice -- it's a single explicit
// boolean gate. apiEnabled only ever becomes true on an exact string match
// against 'true', never any other truthy-looking value (so '1', 'yes', or a
// stray trailing space in a .env file can't silently enable real spending).
// See validate-production-env.ts for the matching boot-time safety check.
//
// inputPricePerMTokUsd/outputPricePerMTokUsd are NOT derived from
// summaryModel -- if CLAUDE_SUMMARY_MODEL is ever changed, these two prices
// must be updated to match in .env, deliberately, rather than silently
// staying wrong. Documented in .env.example, not hidden in code.
export default registerAs('claude', () => ({
  apiEnabled: process.env.CLAUDE_API_ENABLED === 'true',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  summaryModel: process.env.CLAUDE_SUMMARY_MODEL || 'claude-sonnet-5-5',
  maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10),
  maxInputTokens: parseInt(process.env.CLAUDE_MAX_INPUT_TOKENS || '150000', 10),
  requestTimeoutMs: parseInt(process.env.CLAUDE_REQUEST_TIMEOUT || '60000', 10),
  maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '2', 10),
  maxPagesPerAnalysis: parseInt(process.env.CLAUDE_MAX_PAGES_PER_ANALYSIS || '100', 10),
  inputPricePerMTokUsd: parseFloat(process.env.CLAUDE_INPUT_PRICE_PER_MTOK_USD || '2.00'),
  outputPricePerMTokUsd: parseFloat(process.env.CLAUDE_OUTPUT_PRICE_PER_MTOK_USD || '10.00'),
}));
