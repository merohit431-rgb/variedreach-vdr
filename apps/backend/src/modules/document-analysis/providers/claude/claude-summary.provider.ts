import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ClaudeAuthError,
  ClaudeChunkAnalysisResult,
  ClaudeInvalidResponseError,
  ClaudeRateLimitedError,
  ClaudeTimeoutError,
  ClaudeTransientError,
  DocumentSynthesisProvider,
} from './claude-summary.interface';
import { buildMessages, DOCUMENT_TEXT_TOOL, SYSTEM_PROMPT } from './claude-prompt.builder';
import { CHUNK_ANALYSIS_JSON_SCHEMA, ParsedChunkAnalysis } from './claude-response.schema';
import { ChunkSentenceInput } from '../../chunking/page-chunk.builder';

// The ONLY real implementation of DocumentSynthesisProvider -- Anthropic is
// the sole AI provider for this feature, no OpenAI, no provider-selection
// factory. The Anthropic client is never constructed when claude.apiEnabled
// is false -- this is what makes "CLAUDE_API_ENABLED=false means zero
// network-capable code executes" a provable, test-asserted fact rather than
// an assumption: a test can mock the Anthropic constructor itself and assert
// it is never called at all while the flag is off.
@Injectable()
export class ClaudeSummaryProvider implements DocumentSynthesisProvider {
  private readonly logger = new Logger(ClaudeSummaryProvider.name);
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.configService.get<string>('claude.apiKey'),
        maxRetries: this.configService.get<number>('claude.maxRetries'),
        timeout: this.configService.get<number>('claude.requestTimeoutMs'),
      });
    }
    return this.client;
  }

  async analyzeChunk(
    sentences: ChunkSentenceInput[],
    context: { documentAnalysisId: string; chunkIndex: number; totalChunks: number },
  ): Promise<ClaudeChunkAnalysisResult> {
    // Defense in depth: redundant with ClaudeSynthesisService's own check
    // before this is ever called, mirroring how ExternalAiRankingProvider
    // (Phase 3B) already checks its own config internally even though its
    // module-level factory also decides whether to wire it in at all.
    if (!this.configService.get<boolean>('claude.apiEnabled')) {
      throw new ClaudeAuthError('Claude API is not enabled (CLAUDE_API_ENABLED is not "true")');
    }

    const model = this.configService.get<string>('claude.summaryModel')!;
    const maxTokens = this.configService.get<number>('claude.maxTokens')!;

    let response: Anthropic.Message;
    try {
      response = await this.getClient().messages.create({
        model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: buildMessages(sentences, context.chunkIndex, context.totalChunks),
        tools: [DOCUMENT_TEXT_TOOL],
        output_config: { format: { type: 'json_schema', schema: CHUNK_ANALYSIS_JSON_SCHEMA } },
      });
    } catch (error) {
      throw this.mapError(error);
    }

    return this.parseResponse(response, model);
  }

  private parseResponse(response: Anthropic.Message, requestedModel: string): ClaudeChunkAnalysisResult {
    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    if (!textBlock) {
      throw new ClaudeInvalidResponseError('Anthropic response contained no text content block');
    }

    let parsed: ParsedChunkAnalysis;
    try {
      parsed = JSON.parse(textBlock.text) as ParsedChunkAnalysis;
    } catch {
      // Structured outputs' constrained decoding makes this exceedingly
      // unlikely, but schema-validity guarantees are a property of the API,
      // not of this code -- parse failures are still handled explicitly
      // rather than assumed impossible.
      throw new ClaudeInvalidResponseError('Anthropic response text was not valid JSON');
    }

    if (!Array.isArray(parsed?.statements)) {
      throw new ClaudeInvalidResponseError('Anthropic response JSON did not match the expected schema');
    }

    return {
      statements: parsed.statements.map((s) => ({
        sectionType: s.sectionType as ClaudeChunkAnalysisResult['statements'][number]['sectionType'],
        statementText: s.statementText,
        citedSentenceIds: Array.isArray(s.citedSentenceIds) ? s.citedSentenceIds : [],
      })),
      modelUsed: response.model ?? requestedModel,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      stopReason: response.stop_reason ?? null,
    };
  }

  private mapError(error: unknown): Error {
    if (error instanceof Anthropic.RateLimitError) {
      return new ClaudeRateLimitedError(error.message);
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new ClaudeTimeoutError(error.message);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return new ClaudeAuthError(error.message);
    }
    if (error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
      return new ClaudeTransientError(error instanceof Error ? error.message : 'Anthropic API connection error');
    }
    this.logger.warn(`Unmapped Anthropic API error: ${error instanceof Error ? error.message : String(error)}`);
    return error instanceof Error ? error : new ClaudeInvalidResponseError('Unknown Anthropic API error');
  }
}
