import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { FilesModule } from '../files/files.module';
import { DocumentAnalysisService } from './document-analysis.service';
import { DocumentAnalysisController } from './document-analysis.controller';
import { DocumentAnalysisProcessor } from './document-analysis.processor';
import { PdfExtractionAdapter } from './extraction/pdf-extraction.adapter';
import { SentenceSegmentationService } from './extraction/sentence-segmentation.service';
import { MockRankingProvider } from './providers/mock-ranking.provider';
import { ExternalAiRankingProvider } from './providers/external-ranking.provider';
import { RANKING_PROVIDER } from './providers/ranking-provider.interface';
import { ANALYSIS_QUEUE, ANALYSIS_QUEUE_NAME, AnalysisJobData } from './document-analysis.constants';
import { OcrAdapter } from './extraction/ocr/ocr.adapter';
import { ClaudeSummaryProvider } from './providers/claude/claude-summary.provider';
import { DOCUMENT_SYNTHESIS_PROVIDER } from './providers/claude/claude-summary.interface';
import { StatementVerificationService } from './verification/statement-verification.service';
import { AiBudgetGuard } from './budget/ai-budget.guard';
import { AiUsageLedgerService } from './budget/ai-usage-ledger.service';
import { ClaudeSynthesisService } from './synthesis/claude-synthesis.service';

// Queue/Worker are wired by hand from the raw, genuinely-CJS `bullmq`
// package rather than via @nestjs/bullmq -- see the comment at the top of
// document-analysis.processor.ts for why that package (ESM-only, no CJS
// build) is unsafe to rely on against this backend's plain `node dist/main.js`
// CommonJS entrypoint on the pinned node:20-alpine production image.
//
// Known limitation, deliberately not fixed here: neither instance is closed
// on shutdown. This app does not call `app.enableShutdownHooks()` anywhere
// today (confirmed -- PrismaService already has an OnModuleDestroy that
// never fires for the same reason), so wiring a graceful close for just
// these two would be inconsistent with how every other external connection
// in this app already behaves, and enabling shutdown hooks globally as a
// side effect of this feature is out of this phase's scope. The practical
// effect is the same as today's Postgres connection handling: the process
// exit (not a clean disconnect) ends the TCP connection, which Redis treats
// the same as any other client disappearing.
@Module({
  imports: [FilesModule],
  controllers: [DocumentAnalysisController],
  providers: [
    DocumentAnalysisService,
    DocumentAnalysisProcessor,
    PdfExtractionAdapter,
    SentenceSegmentationService,
    MockRankingProvider,
    ExternalAiRankingProvider,
    {
      provide: RANKING_PROVIDER,
      useFactory: (config: ConfigService, mock: MockRankingProvider, external: ExternalAiRankingProvider) =>
        config.get<string>('ranking.provider') === 'external' ? external : mock,
      inject: [ConfigService, MockRankingProvider, ExternalAiRankingProvider],
    },
    // Phase 3C: Claude-backed synthesis, strictly additive alongside the
    // RANKING_PROVIDER machinery above, which is untouched. Unlike
    // RANKING_PROVIDER, there is no provider-selection factory here --
    // Anthropic is the sole AI provider per the brief, so
    // DOCUMENT_SYNTHESIS_PROVIDER always resolves to the one real
    // implementation. Safety comes from ClaudeSynthesisService/
    // ClaudeSummaryProvider's own internal claude.apiEnabled checks, not
    // from a provider swap.
    OcrAdapter,
    ClaudeSummaryProvider,
    { provide: DOCUMENT_SYNTHESIS_PROVIDER, useClass: ClaudeSummaryProvider },
    StatementVerificationService,
    AiBudgetGuard,
    AiUsageLedgerService,
    ClaudeSynthesisService,
    {
      provide: ANALYSIS_QUEUE,
      useFactory: (config: ConfigService) =>
        new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
          connection: { url: config.get<string>('queue.redisUrl') },
          defaultJobOptions: {
            // A worker-process crash (not a caught application error -- see
            // DocumentAnalysisProcessor's own try/catch, which never
            // rethrows) gets one automatic retry before BullMQ gives up and
            // the Worker's 'failed' listener below reconciles the DB row.
            attempts: 2,
            backoff: { type: 'exponential', delay: 10_000 },
          },
        }),
      inject: [ConfigService],
    },
    {
      // Constructed from the already-DI-resolved DocumentAnalysisProcessor
      // instance -- its process()/onJobFailed() methods are handed to the
      // raw Worker as plain callbacks, replacing what @Processor()/
      // @OnWorkerEvent('failed') would have wired declaratively.
      provide: 'ANALYSIS_WORKER',
      useFactory: (config: ConfigService, processor: DocumentAnalysisProcessor) => {
        const worker = new Worker<AnalysisJobData>(
          ANALYSIS_QUEUE_NAME,
          (job: Job<AnalysisJobData>) => processor.process(job),
          {
            connection: { url: config.get<string>('queue.redisUrl') },
            concurrency: 2,
          },
        );
        const logger = new Logger(DocumentAnalysisProcessor.name);
        worker.on('failed', (job) => {
          processor.onJobFailed(job).catch((error: Error) => {
            logger.error(`onJobFailed itself failed for job ${job?.id}: ${error.message}`);
          });
        });
        return worker;
      },
      inject: [ConfigService, DocumentAnalysisProcessor],
    },
  ],
  exports: [DocumentAnalysisService],
})
export class DocumentAnalysisModule {}
