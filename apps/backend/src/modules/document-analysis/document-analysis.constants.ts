export const ANALYSIS_QUEUE_NAME = 'document-analysis';

// DI token for the raw bullmq Queue instance (see document-analysis.module.ts
// for why this is wired manually instead of via @nestjs/bullmq's
// @InjectQueue/@Processor decorators -- that package is ESM-only with no CJS
// build, which is incompatible with this backend's plain `node dist/main.js`
// CommonJS entrypoint on the pinned node:20-alpine production image).
export const ANALYSIS_QUEUE = 'ANALYSIS_QUEUE';

// Opaque IDs only -- the worker re-reads everything else (file bytes,
// extracted text) from Postgres/storage by ID. Redis has no auth configured
// anywhere in this stack; nothing sensitive is ever put through it as a
// consequence, regardless of who else can reach that Redis instance.
export interface AnalysisJobData {
  documentAnalysisId: string;
}
