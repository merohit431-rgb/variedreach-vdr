import { SummarySectionType } from '@prisma/client';
import { ChunkSentenceInput } from '../../chunking/page-chunk.builder';

export interface ClaudeStatementCandidate {
  sectionType: SummarySectionType;
  statementText: string;
  // Claude's claimed evidence -- never trusted without independent
  // validation downstream (StatementVerificationService). An invented,
  // cross-chunk, or wrong-tenant ID here is rejected before persistence,
  // the same discipline Phase 3B's SummarySentenceReference already applies.
  citedSentenceIds: string[];
}

export interface ClaudeChunkAnalysisResult {
  statements: ClaudeStatementCandidate[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

export const DOCUMENT_SYNTHESIS_PROVIDER = 'DOCUMENT_SYNTHESIS_PROVIDER';

// Mirrors the existing SummaryRankingProvider DI-token pattern, but purely
// for test isolation (ClaudeSynthesisService's own spec injects a fake
// implementation the same way document-analysis.processor.spec.ts already
// injects a fake SummaryRankingProvider) -- NOT groundwork for a second real
// provider. Anthropic is the sole AI provider per the Phase 3C brief; there
// is exactly one real implementation (ClaudeSummaryProvider), no
// provider-selection factory choosing between two classes.
export interface DocumentSynthesisProvider {
  analyzeChunk(
    sentences: ChunkSentenceInput[],
    context: { documentAnalysisId: string; chunkIndex: number; totalChunks: number },
  ): Promise<ClaudeChunkAnalysisResult>;
}

// Typed error classes mirroring pdf-extraction.adapter.ts's existing
// PdfEncryptedError/PdfUnreadableError/PdfTooLargeError pattern -- each maps
// a specific, anticipated failure mode to a small, named class so callers
// can branch on `instanceof` rather than inspecting SDK-internal error
// shapes directly.
export class ClaudeRateLimitedError extends Error {
  constructor(message = 'Anthropic API rate limit exceeded') {
    super(message);
    this.name = 'ClaudeRateLimitedError';
  }
}

export class ClaudeTimeoutError extends Error {
  constructor(message = 'Anthropic API request timed out') {
    super(message);
    this.name = 'ClaudeTimeoutError';
  }
}

export class ClaudeAuthError extends Error {
  constructor(message = 'Anthropic API authentication failed') {
    super(message);
    this.name = 'ClaudeAuthError';
  }
}

export class ClaudeTransientError extends Error {
  constructor(message = 'Anthropic API is temporarily unavailable') {
    super(message);
    this.name = 'ClaudeTransientError';
  }
}

// Schema-validity (guaranteed by output_config.format's constrained
// decoding) is not the same as a response this code can actually use --
// this covers the defensive gap between "valid JSON matching the schema"
// and "a shape ClaudeSummaryProvider's own parsing actually expects."
export class ClaudeInvalidResponseError extends Error {
  constructor(message = 'Anthropic API returned a response this provider could not process') {
    super(message);
    this.name = 'ClaudeInvalidResponseError';
  }
}
