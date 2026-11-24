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
//
// Phase 3C.3 production-activation gate: CLAUDE_API_ENABLED=true alone is
// sufficient on staging (APP_ENVIRONMENT=staging) -- this is the existing,
// already-authorized pilot mechanism, unchanged. Everywhere else (i.e. real
// production), it additionally requires CLAUDE_PRODUCTION_ACTIVATION_APPROVED
// to be exactly 'true' -- a second, independent flag representing a human's
// explicit attestation that every non-technical prerequisite in
// ANTHROPIC_ACTIVATION_RUNBOOK.md (a real production key, an approved paying
// subscription for the activating customer, an approved spending budget, a
// verified usage ledger, and a final sign-off) has actually been checked,
// not just that the technical wiring exists. Neither variable being set is
// the default, safe state -- this computes to false (fail closed) with zero
// crash, exactly like every other disabled-by-default state in this file.
// See validate-production-env.ts: a missing ANTHROPIC_API_KEY while
// CLAUDE_API_ENABLED=true still fails the boot outright, in every
// environment, staging included -- that crash protects against "the flag
// is on but this can't structurally work at all," a different, stricter
// class of mistake than the production-activation attestation below, which
// degrades gracefully instead.
export default registerAs('claude', () => {
  const isStagingEnvironment = process.env.APP_ENVIRONMENT === 'staging';
  const productionActivationApproved = process.env.CLAUDE_PRODUCTION_ACTIVATION_APPROVED === 'true';

  return {
    apiEnabled: process.env.CLAUDE_API_ENABLED === 'true' && (isStagingEnvironment || productionActivationApproved),
    productionActivationApproved,
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  summaryModel: process.env.CLAUDE_SUMMARY_MODEL || 'claude-sonnet-5-5',
  maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10),
  maxInputTokens: parseInt(process.env.CLAUDE_MAX_INPUT_TOKENS || '150000', 10),
  requestTimeoutMs: parseInt(process.env.CLAUDE_REQUEST_TIMEOUT || '60000', 10),
  maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '2', 10),
  maxPagesPerAnalysis: parseInt(process.env.CLAUDE_MAX_PAGES_PER_ANALYSIS || '100', 10),
    inputPricePerMTokUsd: parseFloat(process.env.CLAUDE_INPUT_PRICE_PER_MTOK_USD || '2.00'),
    outputPricePerMTokUsd: parseFloat(process.env.CLAUDE_OUTPUT_PRICE_PER_MTOK_USD || '10.00'),
  };
});
