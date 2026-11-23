import { registerAs } from '@nestjs/config';

// These are conservative SUGGESTED STARTING POINTS, not pre-approved
// spending limits -- Phase 3C requires a separately, explicitly approved
// spending cap before any real (paid) Claude call is ever made at all (see
// claude.config.ts's apiEnabled gate, which stays false independently of
// whatever these numbers say). Changing these values alone never enables
// spending by itself.
export default registerAs('aiBudget', () => ({
  maxCostPerDocumentUsd: parseFloat(process.env.AI_MAX_COST_PER_DOCUMENT_USD || '0.50'),
  maxDailyOrgCostUsd: parseFloat(process.env.AI_MAX_DAILY_ORG_COST_USD || '5.00'),
  maxMonthlyOrgCostUsd: parseFloat(process.env.AI_MAX_MONTHLY_ORG_COST_USD || '50.00'),
  maxGlobalStagingCostUsd: parseFloat(process.env.AI_MAX_GLOBAL_STAGING_COST_USD || '100.00'),
  maxConcurrentJobs: parseInt(process.env.AI_MAX_CONCURRENT_JOBS || '2', 10),
}));
