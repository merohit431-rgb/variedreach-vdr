import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DocumentAnalysisStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { FolderAccessService } from '../folder-access/folder-access.service';
import { FilesService } from '../files/files.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { isPdf } from '../../common/constants/file-type-rules';
import { ANALYSIS_QUEUE, AnalysisJobData } from './document-analysis.constants';

// Every method here independently re-runs the full auth chain
// (assertCanDownload -> getFileOrThrow -> folder-access resolver), including
// status polling and result fetch, not just the initial request. This is
// deliberate: a DocumentAnalysis row can sit COMPLETED for weeks after a
// folder grant is revoked, and nothing here may shortcut through the
// denormalised dataRoomId/organisationId columns on that row instead of
// re-deriving access fresh on every single call -- that is exactly the gap
// that would quietly reopen if a later change "optimised" this away.
//
// Gated on assertCanDownload (excludes GUEST), not the looser tier
// FILE_VIEWED/preview uses: a summary is plain, unwatermarked, copy-pasteable
// text with no traceability mark, so it is a more exposed channel than a
// watermarked preview for the same content. Every result fetch is audited
// for the same reason -- the audit log is the only forensic trail this
// channel has.
@Injectable()
export class DocumentAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly folderAccess: FolderAccessService,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService,
    @Inject(ANALYSIS_QUEUE) private readonly queue: Queue<AnalysisJobData>,
  ) {}

  async requestAnalysis(dataRoomId: string, fileId: string, actor: AuthenticatedUser, clientIp?: string) {
    const file = await this.assertEligibleAndReachable(dataRoomId, fileId, actor, clientIp);

    if (!file.currentVersionId) {
      throw new BadRequestException('This file has no uploaded version to analyse');
    }

    const maxFileSizeBytes = this.configService.get<number>('queue.maxFileSizeBytes')!;
    if (Number(file.sizeBytes) > maxFileSizeBytes) {
      throw new BadRequestException(
        `This file is too large to analyse (limit: ${Math.floor(maxFileSizeBytes / (1024 * 1024))} MB)`,
      );
    }

    const version = await this.prisma.fileVersion.findUniqueOrThrow({ where: { id: file.currentVersionId } });

    const existing = await this.prisma.documentAnalysis.findFirst({
      where: {
        fileId,
        fileVersionId: version.id,
        status: { in: [DocumentAnalysisStatus.PENDING, DocumentAnalysisStatus.PROCESSING] },
      },
      orderBy: { analysisVersion: 'desc' },
    });
    if (existing) {
      return existing;
    }

    const latest = await this.prisma.documentAnalysis.findFirst({
      where: { fileId, fileVersionId: version.id },
      orderBy: { analysisVersion: 'desc' },
    });
    const isRegeneration = Boolean(latest);

    let analysis;
    try {
      analysis = await this.prisma.documentAnalysis.create({
        data: {
          fileId,
          fileVersionId: version.id,
          dataRoomId,
          organisationId: actor.organisationId,
          status: DocumentAnalysisStatus.PENDING,
          analysisVersion: (latest?.analysisVersion ?? 0) + 1,
          originalChecksum: version.checksum,
          requestedBy: actor.id,
        },
      });
    } catch (error) {
      // The existing-PENDING/PROCESSING check above and this create() are
      // not one atomic operation -- found via Phase 3B.1's concurrent-request
      // testing: two genuinely simultaneous requests can both pass that
      // check (neither sees the other's row yet) and then race on this
      // create(), so the loser hits the @@unique([fileId, fileVersionId,
      // analysisVersion]) constraint instead of a clean "already requested"
      // response. The constraint itself already does its job -- no duplicate
      // row is ever actually created -- this only replaces the raw 500 the
      // loser would otherwise see with the same row the winner just created.
      if ((error as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.documentAnalysis.findFirst({
          where: { fileId, fileVersionId: version.id },
          orderBy: { analysisVersion: 'desc' },
        });
        if (winner) return winner;
      }
      throw error;
    }

    await this.queue.add(
      'analyze',
      { documentAnalysisId: analysis.id },
      { jobId: analysis.id, removeOnComplete: true, removeOnFail: false },
    );

    await this.auditLogService.record({
      action: 'DOCUMENT_ANALYSIS_REQUESTED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: fileId,
      metadata: { analysisId: analysis.id, isRegeneration },
      ipAddress: clientIp,
    });

    return analysis;
  }

  async getLatestAnalysis(dataRoomId: string, fileId: string, actor: AuthenticatedUser, clientIp?: string) {
    await this.assertEligibleAndReachable(dataRoomId, fileId, actor, clientIp);

    const analysis = await this.prisma.documentAnalysis.findFirst({
      where: { fileId, dataRoomId },
      orderBy: { analysisVersion: 'desc' },
    });
    if (!analysis) return null;

    return this.loadAndAuditView(analysis.id, dataRoomId, fileId, actor, clientIp);
  }

  async getAnalysisById(
    dataRoomId: string,
    fileId: string,
    analysisId: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    await this.assertEligibleAndReachable(dataRoomId, fileId, actor, clientIp);
    return this.loadAndAuditView(analysisId, dataRoomId, fileId, actor, clientIp);
  }

  async retryAnalysis(
    dataRoomId: string,
    fileId: string,
    analysisId: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    await this.assertEligibleAndReachable(dataRoomId, fileId, actor, clientIp);
    const analysis = await this.getAnalysisOrThrow(analysisId, dataRoomId, fileId);

    if (analysis.status !== DocumentAnalysisStatus.FAILED) {
      throw new ConflictException('Only a failed analysis can be retried');
    }

    const updated = await this.prisma.documentAnalysis.update({
      where: { id: analysisId },
      data: { status: DocumentAnalysisStatus.PENDING, errorMessage: null, startedAt: null, completedAt: null },
    });

    await this.queue.add(
      'analyze',
      { documentAnalysisId: analysis.id },
      { jobId: `${analysis.id}-retry-${Date.now()}`, removeOnComplete: true, removeOnFail: false },
    );

    await this.auditLogService.record({
      action: 'DOCUMENT_ANALYSIS_RETRIED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: fileId,
      metadata: { analysisId },
      ipAddress: clientIp,
    });

    return updated;
  }

  async cancelAnalysis(
    dataRoomId: string,
    fileId: string,
    analysisId: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    await this.assertEligibleAndReachable(dataRoomId, fileId, actor, clientIp);
    const analysis = await this.getAnalysisOrThrow(analysisId, dataRoomId, fileId);

    const cancellableStatuses: DocumentAnalysisStatus[] = [
      DocumentAnalysisStatus.PENDING,
      DocumentAnalysisStatus.PROCESSING,
    ];
    if (!cancellableStatuses.includes(analysis.status)) {
      throw new ConflictException('Only a pending or in-progress analysis can be cancelled');
    }

    const job = await this.queue.getJob(analysisId);
    await job?.remove().catch(() => undefined);

    await this.prisma.documentAnalysis.update({
      where: { id: analysisId },
      data: { status: DocumentAnalysisStatus.CANCELLED, completedAt: new Date() },
    });

    await this.auditLogService.record({
      action: 'DOCUMENT_ANALYSIS_CANCELLED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: fileId,
      metadata: { analysisId },
      ipAddress: clientIp,
    });
  }

  private async loadAndAuditView(
    analysisId: string,
    dataRoomId: string,
    fileId: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    const analysis = await this.getAnalysisOrThrow(analysisId, dataRoomId, fileId, {
      sections: {
        orderBy: { displayOrder: 'asc' },
        include: {
          sentenceRefs: {
            orderBy: { rank: 'asc' },
            include: { sentence: true },
          },
        },
      },
      // Phase 3C additions. `pages` was never returned by any route before
      // this -- carries no sentence text, only per-page extraction metadata
      // (method, OCR confidence), so this adds no new text-leakage surface.
      // `aiSummaryRun` is null/absent whenever Claude was never enabled for
      // this analysis, preserving the exact pre-Phase-3C response shape in
      // that case. Both flow through the SAME access-control chokepoint
      // (assertEligibleAndReachable) as everything else this method
      // returns -- no separate gate, no shortcut.
      pages: { orderBy: { pageNumber: 'asc' } },
      aiSummaryRun: {
        include: {
          statements: {
            orderBy: { displayOrder: 'asc' },
            include: { citations: { include: { sentence: true } } },
          },
        },
      },
    });

    await this.auditLogService.record({
      action: 'DOCUMENT_ANALYSIS_VIEWED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: fileId,
      metadata: { analysisId: analysis.id, status: analysis.status },
      ipAddress: clientIp,
    });

    return analysis;
  }

  private async getAnalysisOrThrow(
    analysisId: string,
    dataRoomId: string,
    fileId: string,
    include?: Record<string, unknown>,
  ) {
    const analysis = await this.prisma.documentAnalysis.findFirst({
      where: { id: analysisId, dataRoomId, fileId },
      include,
    });
    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }
    return analysis;
  }

  // The single chokepoint every public method above runs through, fresh,
  // every single call -- never cached, never shortcut.
  private async assertEligibleAndReachable(
    dataRoomId: string,
    fileId: string,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    const { effectiveRole } = await this.dataRoomAccess.assertCanDownload(dataRoomId, actor, clientIp);
    const file = await this.filesService.getFileOrThrow(dataRoomId, fileId);

    const resolver = await this.folderAccess.buildResolver(dataRoomId, actor, effectiveRole);
    await this.folderAccess.assertReachable(resolver, file.folderId, 'File not found', {
      dataRoomId,
      actor,
      resourceType: 'File',
      resourceId: file.id,
      ipAddress: clientIp,
    });

    if (!isPdf(file.extension)) {
      throw new BadRequestException('Only PDF files can be analysed');
    }

    return file;
  }
}
