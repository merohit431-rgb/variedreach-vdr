import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiSummaryRunStatus, DocumentAnalysisStatus, StatementVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { ChunkSentenceInput, buildPageChunks } from '../chunking/page-chunk.builder';
import { StatementVerificationService } from '../verification/statement-verification.service';
import { AiBudgetGuard } from '../budget/ai-budget.guard';
import { AiUsageLedgerService } from '../budget/ai-usage-ledger.service';
import {
  ClaudeChunkAnalysisResult,
  DOCUMENT_SYNTHESIS_PROVIDER,
  DocumentSynthesisProvider,
} from '../providers/claude/claude-summary.interface';

export interface ClaudeSynthesisInput {
  documentAnalysisId: string;
  dataRoomId: string;
  organisationId: string;
  fileId: string;
  jobId: string;
  sentences: ChunkSentenceInput[];
}

// Orchestrates the Claude-backed synthesis path: chunking, the budget
// guard, the provider call, citation validation, statement verification,
// and persistence. Called from DocumentAnalysisProcessor AFTER the existing
// extraction/segmentation/Mock-provider section-writing block runs
// unconditionally and unchanged -- this is strictly additive, writing only
// to the new ai_summary_* tables. Returns null when the feature is disabled
// (nothing was attempted -- no row of any kind is created), or the
// resulting AiSummaryRunStatus otherwise.
@Injectable()
export class ClaudeSynthesisService {
  private readonly logger = new Logger(ClaudeSynthesisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly budgetGuard: AiBudgetGuard,
    private readonly usageLedger: AiUsageLedgerService,
    private readonly verificationService: StatementVerificationService,
    @Inject(DOCUMENT_SYNTHESIS_PROVIDER) private readonly provider: DocumentSynthesisProvider,
  ) {}

  async run(input: ClaudeSynthesisInput): Promise<AiSummaryRunStatus | null> {
    // Defense in depth -- mirrors the processor's own gate at the call site
    // and the provider's own internal check. A disabled feature creates no
    // row of any kind, not even a SKIPPED one.
    if (!this.configService.get<boolean>('claude.apiEnabled')) {
      return null;
    }

    if (input.sentences.length === 0) {
      return null;
    }

    const maxInputTokens = this.configService.get<number>('claude.maxInputTokens')!;
    const chunks = buildPageChunks(input.sentences, maxInputTokens);
    const sentenceById = new Map(input.sentences.map((s) => [s.sentenceId, s]));

    const existingRun = await this.prisma.aiSummaryRun.findUnique({ where: { documentAnalysisId: input.documentAnalysisId } });
    const estimatedCostMicroUsd = this.estimateRunCostMicroUsd(chunks);

    // Budget is no longer checked once upfront for the whole run -- it is
    // reserved per CHUNK, immediately before that specific chunk is
    // dispatched (see the loop below), since each chunk is its own real
    // paid Anthropic request and the brief requires a reservation "before
    // every" one of those, not just once per document. estimatedCostMicroUsd
    // is still recorded on the run row below, for visibility only.
    const run = existingRun
      ? await this.prisma.aiSummaryRun.update({
          where: { id: existingRun.id },
          data: {
            status: AiSummaryRunStatus.PROCESSING,
            startedAt: existingRun.startedAt ?? new Date(),
            chunkCount: chunks.length,
            estimatedCostMicroUsd,
          },
        })
      : await this.prisma.aiSummaryRun.create({
          data: {
            documentAnalysisId: input.documentAnalysisId,
            status: AiSummaryRunStatus.PROCESSING,
            modelRequested: this.configService.get<string>('claude.summaryModel')!,
            chunkCount: chunks.length,
            estimatedCostMicroUsd,
            startedAt: new Date(),
          },
        });

    const alreadyCompleted = new Set(run.completedChunkIndexes);
    let anyUnverified = false;
    let totalInputTokens = run.inputTokens;
    let totalOutputTokens = run.outputTokens;
    let totalActualCostMicroUsd = run.actualCostMicroUsd;
    let modelUsed = run.modelUsed;

    for (const chunk of chunks) {
      if (alreadyCompleted.has(chunk.chunkIndex)) continue; // partial-chunk recovery -- never re-pay for completed work

      // Cheap early bail-out: if this analysis was already cancelled before
      // this chunk's turn came up, skip straight past reserving budget for
      // it at all. The LATE check below (after reservation, right before
      // dispatch) is the one that actually matters for correctness; this
      // one just avoids a pointless reserve+release round trip in the
      // common case.
      const early = await this.prisma.documentAnalysis.findUnique({
        where: { id: input.documentAnalysisId },
        select: { status: true },
      });
      if (!early || early.status === DocumentAnalysisStatus.CANCELLED) {
        await this.prisma.aiSummaryRun.update({ where: { id: run.id }, data: { status: AiSummaryRunStatus.FAILED, errorMessage: 'Cancelled', completedAt: new Date() } });
        return AiSummaryRunStatus.FAILED;
      }

      const chunkEstimateMicroUsd = this.estimateChunkCostMicroUsd(chunk.sentences);
      const reservation = await this.budgetGuard.reserveBudget({
        organisationId: input.organisationId,
        dataRoomId: input.dataRoomId,
        fileId: input.fileId,
        documentAnalysisId: input.documentAnalysisId,
        aiSummaryRunId: run.id,
        jobId: input.jobId,
        model: run.modelRequested,
        estimatedCostMicroUsd: chunkEstimateMicroUsd,
      });

      if (!reservation.allowed) {
        await this.auditLogService
          .record({
            action: 'AI_BUDGET_LIMIT_REACHED',
            dataRoomId: input.dataRoomId,
            resourceType: 'File',
            resourceId: input.fileId,
            metadata: { documentAnalysisId: input.documentAnalysisId, limitType: reservation.reason, chunkIndex: chunk.chunkIndex },
          })
          .catch(() => undefined);
        // Chunks completed before this one keep their already-persisted
        // statements -- a graceful partial result, not an all-or-nothing
        // discard, exactly like the existing partial-chunk-recovery
        // guarantee for a crashed/retried job.
        await this.prisma.aiSummaryRun.update({
          where: { id: run.id },
          data: { status: AiSummaryRunStatus.SKIPPED_LIMIT_REACHED, completedAt: new Date() },
        });
        return AiSummaryRunStatus.SKIPPED_LIMIT_REACHED;
      }

      // Re-read fresh (not `early`, and not the outer `input`) as late as
      // possible -- right before dispatch, after the reservation already
      // exists -- so a cancellation that lands in the gap between the
      // early check and now is still caught before any network call, and
      // the reservation it would otherwise strand is released rather than
      // left permanently counting against budget for nothing.
      const late = await this.prisma.documentAnalysis.findUnique({
        where: { id: input.documentAnalysisId },
        select: { status: true },
      });
      if (!late || late.status === DocumentAnalysisStatus.CANCELLED) {
        await this.usageLedger.release(reservation.reservationId!);
        await this.prisma.aiSummaryRun.update({ where: { id: run.id }, data: { status: AiSummaryRunStatus.FAILED, errorMessage: 'Cancelled', completedAt: new Date() } });
        return AiSummaryRunStatus.FAILED;
      }

      let result: ClaudeChunkAnalysisResult;
      try {
        result = await this.provider.analyzeChunk(chunk.sentences, {
          documentAnalysisId: input.documentAnalysisId,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunks.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await this.usageLedger.finalizeFailure(reservation.reservationId!, this.classifyFailureStatus(error));
        await this.prisma.aiSummaryRun.update({
          where: { id: run.id },
          data: { status: AiSummaryRunStatus.FAILED, errorMessage: message, completedAt: new Date() },
        });
        this.logger.warn(`Claude synthesis chunk ${chunk.chunkIndex} failed for analysis ${input.documentAnalysisId}: ${message}`);
        return AiSummaryRunStatus.FAILED;
      }

      modelUsed = result.modelUsed;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      const actualCostMicroUsd = this.computeCostMicroUsd(result.inputTokens, result.outputTokens);
      totalActualCostMicroUsd += actualCostMicroUsd;

      await this.usageLedger.finalizeSuccess(reservation.reservationId!, {
        model: result.modelUsed,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        actualCostMicroUsd,
      });

      const inChunkIds = new Set(chunk.sentences.map((s) => s.sentenceId));
      let displayOrder = await this.prisma.aiSummaryStatement.count({ where: { aiSummaryRunId: run.id } });

      for (const candidate of result.statements) {
        // The citation-validity gate: a cited ID must both exist as a real
        // ExtractedSentence for THIS exact document AND have been part of
        // THIS SPECIFIC chunk Claude was shown -- a real, existing ID from a
        // different chunk of the same document is still a hallucinated
        // citation here, a check Phase 3B never needed since it never
        // partitioned sentences across calls.
        const validCitedIds = candidate.citedSentenceIds.filter((id) => inChunkIds.has(id) && sentenceById.has(id));
        if (validCitedIds.length === 0) {
          this.logger.warn(
            `Dropped a Claude statement for analysis ${input.documentAnalysisId}: all ${candidate.citedSentenceIds.length} cited sentenceId(s) were invalid or outside this chunk`,
          );
          continue;
        }

        const citationInputs = validCitedIds.map((id) => {
          const sentence = sentenceById.get(id)!;
          return { sentenceId: id, pageNumber: sentence.pageNumber, text: sentence.text };
        });
        const verification = this.verificationService.verify(candidate.statementText, citationInputs);
        if (verification.status !== StatementVerificationStatus.VERIFIED) anyUnverified = true;

        await this.prisma.aiSummaryStatement.create({
          data: {
            aiSummaryRunId: run.id,
            sectionType: candidate.sectionType,
            displayOrder: displayOrder++,
            statementText: candidate.statementText,
            verificationStatus: verification.status,
            verificationDetails: verification.details as never,
            citations: {
              create: validCitedIds.map((id, index) => ({ extractedSentenceId: id, citationOrder: index })),
            },
          },
        });
      }

      await this.prisma.aiSummaryRun.update({
        where: { id: run.id },
        data: {
          completedChunkIndexes: { push: chunk.chunkIndex },
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          actualCostMicroUsd: totalActualCostMicroUsd,
          modelUsed,
        },
      });
    }

    const finalStatus = anyUnverified ? AiSummaryRunStatus.COMPLETED_WITH_WARNINGS : AiSummaryRunStatus.COMPLETED;
    await this.prisma.aiSummaryRun.update({ where: { id: run.id }, data: { status: finalStatus, completedAt: new Date() } });
    return finalStatus;
  }

  private classifyFailureStatus(error: unknown): 'FAILED' | 'RATE_LIMITED' | 'TIMEOUT' {
    const name = error instanceof Error ? error.name : '';
    if (name === 'ClaudeRateLimitedError') return 'RATE_LIMITED';
    if (name === 'ClaudeTimeoutError') return 'TIMEOUT';
    return 'FAILED';
  }

  private estimateRunCostMicroUsd(chunks: Array<{ sentences: ChunkSentenceInput[] }>): number {
    return chunks.reduce((total, chunk) => total + this.estimateChunkCostMicroUsd(chunk.sentences), 0);
  }

  // Input is estimated from text length (chars/4); output is estimated at
  // the configured max_tokens ceiling, used as the conservative worst case
  // since the real output length isn't known before the call -- better to
  // over-estimate for a budget gate than under-estimate and overspend.
  private estimateChunkCostMicroUsd(sentences: ChunkSentenceInput[]): number {
    const totalChars = sentences.reduce((sum, s) => sum + s.text.length, 0);
    const estimatedInputTokens = Math.ceil(totalChars / 4) + 500; // fixed overhead: system prompt + schema + instructions
    const estimatedOutputTokens = this.configService.get<number>('claude.maxTokens')!;
    return this.computeCostMicroUsd(estimatedInputTokens, estimatedOutputTokens);
  }

  private computeCostMicroUsd(inputTokens: number, outputTokens: number): number {
    const inputPrice = this.configService.get<number>('claude.inputPricePerMTokUsd')!;
    const outputPrice = this.configService.get<number>('claude.outputPricePerMTokUsd')!;
    const costUsd = (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
    return Math.round(costUsd * 1_000_000);
  }
}
