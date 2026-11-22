import { registerAs } from '@nestjs/config';

// Redis is already provisioned in every compose file but nothing in this
// codebase has connected to it until Phase 3B's analysis job queue. No auth
// is configured on that Redis instance anywhere in this stack -- rather than
// take on hardening it as part of this feature, job payloads carry opaque
// IDs only (documentAnalysisId/fileId/fileVersionId); the worker re-reads
// everything else from Postgres/storage by ID, so nothing sensitive ever
// passes through Redis regardless of who else can reach it.
export default registerAs('queue', () => ({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxPages: parseInt(process.env.ANALYSIS_MAX_PAGES || '500', 10),
  maxFileSizeBytes: parseInt(process.env.ANALYSIS_MAX_FILE_SIZE_BYTES || String(200 * 1024 * 1024), 10),
}));
