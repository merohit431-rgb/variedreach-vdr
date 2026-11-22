import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { createHash } from 'crypto';
import { DocumentAnalysisStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { STORAGE_SERVICE, IStorageService } from '../storage/storage.interface';
import { AnalysisJobData } from './document-analysis.constants';
import {
  PdfEncryptedError,
  PdfExtractionAdapter,
  PdfTooLargeError,
  PdfUnreadableError,
} from './extraction/pdf-extraction.adapter';
import { SentenceSegmentationService } from './extraction/sentence-segmentation.service';
import { RANKING_PROVIDER, RankedSentence, SummaryRankingProvider } from './providers/ranking-provider.interface';

// A plain injectable, NOT a @nestjs/bullmq @Processor/WorkerHost subclass:
// that package is ESM-only with no CJS build at all (its package.json
// "exports" maps both "import" and "require" to the same ESM file), which
// crashes under a true CommonJS `require()` -- exactly how this backend's
// compiled `node dist/main.js` entrypoint loads everything on the pinned
// node:20-alpine production image. (It happens to load fine via plain
// `require()` under this Mac's locally-installed Node 24, which has
// unflagged require(esm) interop -- but that is not a safe assumption for
// Node 20, and Jest's own CJS module loader has no such interop at all,
// which is what actually surfaced this during testing.) document-analysis
// .module.ts wires the raw, genuinely-CJS `bullmq` Queue/Worker classes by
// hand instead, and hands this class's own process()/onJobFailed() methods
// to the Worker as plain callbacks -- no decorators needed here.
//
// Sandboxed-processor-ready regardless: this class has no shared mutable
// state and reads everything it needs by ID, so it could still be moved
// behind BullMQ's separate-process/worker-thread sandboxing later with no
// redesign. Concurrency is capped at 2 in the module's Worker options --
// pdfjs-dist parsing is a second, comparable memory-pressure source in the
// same backend container that pdf-lib watermarking alone already needed
// 512M->2048M for (see queue.config.ts).
@Injectable()
export class DocumentAnalysisProcessor {
  private readonly logger = new Logger(DocumentAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly pdfExtraction: PdfExtractionAdapter,
    private readonly sentenceSegmentation: SentenceSegmentationService,
    @Inject(RANKING_PROVIDER) private readonly rankingProvider: SummaryRankingProvider,
  ) {}

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { documentAnalysisId } = job.data;

    const analysis = await this.prisma.documentAnalysis.findUnique({
      where: { id: documentAnalysisId },
      include: { file: { include: { currentVersion: true } } },
    });
    // The row may have been cancelled (and its job removed) in the window
    // between enqueue and pickup -- nothing to do, not an error.
    if (!analysis || analysis.status === DocumentAnalysisStatus.CANCELLED) {
      return;
    }

    try {
      await this.prisma.documentAnalysis.update({
        where: { id: documentAnalysisId },
        data: { status: DocumentAnalysisStatus.PROCESSING, startedAt: new Date() },
      });

      const version = analysis.file.currentVersion;
      if (!version) {
        throw new PdfUnreadableError('file has no current version');
      }

      const buffer = await this.storage.read(version.storagePath);
      const maxPages = this.configService.get<number>('queue.maxPages')!;
      const pages = await this.pdfExtraction.extractPages(buffer, maxPages);

      const sentenceRows: { pageNumber: number; sequenceNumber: number; text: string; normalizedText: string }[] = [];
      for (const page of pages) {
        if (page.isScannedOrImageOnly) continue;
        const sentences = this.sentenceSegmentation.segment(page.text);
        for (const sentence of sentences) {
          sentenceRows.push({ pageNumber: page.pageNumber, ...sentence });
        }
      }

      await this.prisma.$transaction([
        this.prisma.extractedPage.createMany({
          data: pages.map((p) => ({
            documentAnalysisId,
            pageNumber: p.pageNumber,
            charCount: p.charCount,
            isScannedOrImageOnly: p.isScannedOrImageOnly,
          })),
        }),
        this.prisma.extractedSentence.createMany({
          data: sentenceRows.map((s) => ({ documentAnalysisId, ...s })),
        }),
      ]);

      const writtenSentences = await this.prisma.extractedSentence.findMany({ where: { documentAnalysisId } });
      const sentenceById = new Map(writtenSentences.map((s) => [s.id, s]));

      const rankerInput = writtenSentences.map((s) => ({ sentenceId: s.id, pageNumber: s.pageNumber, text: s.text }));
      let rankedSentences: RankedSentence[];
      try {
        rankedSentences = await this.rankingProvider.rank(rankerInput);
      } catch (error) {
        this.logger.warn(`Ranking provider failed: ${(error as Error).message}`);
        rankedSentences = [];
      }

      // The mandatory verification step: a ranked sentence is written to a
      // SummarySentenceReference ONLY if its sentenceId matches a row that
      // was just written from the verified extraction pass above. Anything
      // else -- an invented ID, a sentence from a different analysis, a
      // duplicate -- is silently dropped here and never reaches the
      // frontend, consistent with "if sentence verification fails, do not
      // display the unverified sentence."
      const verifiedBySection = new Map<string, { extractedSentenceId: string; rank: number; score: number }[]>();
      const seenPerSection = new Set<string>();
      for (const ranked of rankedSentences) {
        const sentence = sentenceById.get(ranked.sentenceId);
        if (!sentence || sentence.documentAnalysisId !== documentAnalysisId) continue;

        const dedupeKey = `${ranked.sectionType}:${ranked.sentenceId}`;
        if (seenPerSection.has(dedupeKey)) continue;
        seenPerSection.add(dedupeKey);

        const list = verifiedBySection.get(ranked.sectionType) ?? [];
        list.push({ extractedSentenceId: ranked.sentenceId, rank: ranked.rank, score: ranked.score });
        verifiedBySection.set(ranked.sectionType, list);
      }

      let displayOrder = 0;
      for (const [sectionType, refs] of verifiedBySection) {
        if (refs.length === 0) continue;
        const section = await this.prisma.summarySection.create({
          data: {
            documentAnalysisId,
            sectionType: sectionType as never,
            displayOrder: displayOrder++,
          },
        });
        await this.prisma.summarySentenceReference.createMany({
          data: refs.map((ref) => ({ summarySectionId: section.id, ...ref })),
        });
      }

      const hasScannedPages = pages.some((p) => p.isScannedOrImageOnly);
      const checksumVerified = await this.verifyChecksum(buffer, analysis.originalChecksum);

      await this.prisma.documentAnalysis.update({
        where: { id: documentAnalysisId },
        data: {
          status: hasScannedPages
            ? DocumentAnalysisStatus.COMPLETED_WITH_WARNINGS
            : DocumentAnalysisStatus.COMPLETED,
          checksumVerified,
          completedAt: new Date(),
        },
      });

      await this.auditLogService.record({
        action: 'DOCUMENT_ANALYSIS_COMPLETED',
        dataRoomId: analysis.dataRoomId,
        resourceType: 'File',
        resourceId: analysis.fileId,
        metadata: {
          analysisId: documentAnalysisId,
          pageCount: pages.length,
          scannedPageCount: pages.filter((p) => p.isScannedOrImageOnly).length,
          sentenceCount: writtenSentences.length,
          checksumVerified,
        },
      });
    } catch (error) {
      await this.handleFailure(documentAnalysisId, analysis.dataRoomId, analysis.fileId, error as Error);
    }
  }

  // Safety net for the rare case where the worker PROCESS itself dies
  // mid-job (OOM kill, uncaught crash outside the try/catch in process()
  // above) rather than process() throwing a catchable error -- BullMQ's own
  // stalled-job detection eventually marks such a job "failed" at the queue
  // level even though nothing in process() ever ran handleFailure(). Wired
  // to the raw Worker's own 'failed' event in document-analysis.module.ts
  // (see the comment on the class above for why this isn't an
  // @OnWorkerEvent decorator); reconciles the DB row so a document can
  // never be left permanently stuck in PROCESSING just because the worker
  // that was handling it no longer exists.
  async onJobFailed(job: Job<AnalysisJobData> | undefined): Promise<void> {
    if (!job) return;
    const analysis = await this.prisma.documentAnalysis.findUnique({ where: { id: job.data.documentAnalysisId } });
    if (!analysis) return;
    if (analysis.status === DocumentAnalysisStatus.PENDING || analysis.status === DocumentAnalysisStatus.PROCESSING) {
      await this.handleFailure(
        analysis.id,
        analysis.dataRoomId,
        analysis.fileId,
        new Error(job.failedReason ?? 'Worker process did not complete this job'),
      );
    }
  }

  private async verifyChecksum(buffer: Buffer, expectedChecksum: string): Promise<boolean> {
    const actual = createHash('sha256').update(buffer).digest('hex');
    const matches = actual === expectedChecksum;
    if (!matches) {
      this.logger.error(
        `Checksum mismatch after processing -- original file integrity could not be confirmed (expected ${expectedChecksum}, got ${actual})`,
      );
    }
    return matches;
  }

  private async handleFailure(documentAnalysisId: string, dataRoomId: string, fileId: string, error: Error) {
    const safeMessage =
      error instanceof PdfEncryptedError || error instanceof PdfUnreadableError || error instanceof PdfTooLargeError
        ? error.message
        : 'This document could not be processed. Please try again or contact support if the problem continues.';

    this.logger.warn(`Analysis ${documentAnalysisId} failed: ${error.message}`);

    await this.prisma.documentAnalysis.update({
      where: { id: documentAnalysisId },
      data: { status: DocumentAnalysisStatus.FAILED, errorMessage: safeMessage, completedAt: new Date() },
    });

    await this.auditLogService
      .record({
        action: 'DOCUMENT_ANALYSIS_FAILED',
        dataRoomId,
        resourceType: 'File',
        resourceId: fileId,
        metadata: { analysisId: documentAnalysisId, reason: safeMessage },
      })
      .catch(() => undefined);
  }
}
