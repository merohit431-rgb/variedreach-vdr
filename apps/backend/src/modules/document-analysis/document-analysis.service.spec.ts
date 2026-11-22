import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentAnalysisStatus } from '@prisma/client';
import { DocumentAnalysisService } from './document-analysis.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { FolderAccessService } from '../folder-access/folder-access.service';
import type { FilesService } from '../files/files.service';
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const ACTOR = { id: 'user-1', organisationId: 'org-1', role: 'RP_LIQUIDATOR' } as AuthenticatedUser;
const PDF_FILE = { id: 'file-1', folderId: 'folder-1', extension: 'pdf', currentVersionId: 'version-1', sizeBytes: 1000 };
const VERSION = { id: 'version-1', checksum: 'checksum-abc' };

function buildService(opts: {
  assertCanDownload?: jest.Mock;
  file?: unknown;
  assertReachable?: jest.Mock;
  existingAnalysis?: unknown;
  latestAnalysis?: unknown;
  analysisById?: unknown;
  maxFileSizeBytes?: number;
}) {
  // 'key' in opts throughout -- several tests deliberately pass null/undefined
  // (no file, no existing analysis, no latest version) and ?? would silently
  // fall through to the default, defeating exactly the case under test.
  const assertCanDownload =
    opts.assertCanDownload ?? jest.fn().mockResolvedValue({ effectiveRole: 'RP_LIQUIDATOR' });
  const getFileOrThrow = jest.fn().mockImplementation(() => {
    const file = 'file' in opts ? opts.file : PDF_FILE;
    if (!file) throw new NotFoundException('File not found');
    return Promise.resolve(file);
  });
  const buildResolver = jest.fn().mockResolvedValue({ resolver: true });
  const assertReachable = opts.assertReachable ?? jest.fn().mockResolvedValue(undefined);

  const findFirst = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (where.status) return Promise.resolve('existingAnalysis' in opts ? opts.existingAnalysis : null);
    if (where.id) return Promise.resolve('analysisById' in opts ? opts.analysisById : null);
    return Promise.resolve('latestAnalysis' in opts ? opts.latestAnalysis : null);
  });
  const create = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'analysis-new', ...data }),
  );
  const update = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'analysis-1', ...data }),
  );
  const findUniqueOrThrow = jest.fn().mockResolvedValue(VERSION);
  const record = jest.fn().mockResolvedValue({});
  const queueAdd = jest.fn().mockResolvedValue({});
  const getJob = jest.fn().mockResolvedValue({ remove: jest.fn().mockResolvedValue(undefined) });

  const prisma = {
    documentAnalysis: { findFirst, create, update },
    fileVersion: { findUniqueOrThrow },
  } as unknown as PrismaService;

  const configService = {
    get: jest.fn((key: string) => (key === 'queue.maxFileSizeBytes' ? opts.maxFileSizeBytes ?? 200 * 1024 * 1024 : undefined)),
  } as unknown as ConfigService;

  const service = new DocumentAnalysisService(
    prisma,
    { record } as unknown as AuditLogService,
    { assertCanDownload } as unknown as DataRoomAccessService,
    { buildResolver, assertReachable } as unknown as FolderAccessService,
    { getFileOrThrow } as unknown as FilesService,
    configService,
    { add: queueAdd, getJob } as never,
  );

  return { service, assertCanDownload, getFileOrThrow, buildResolver, assertReachable, create, update, record, queueAdd, getJob };
}

describe('DocumentAnalysisService -- authorisation chain', () => {
  it('requestAnalysis runs assertCanDownload -> getFileOrThrow -> buildResolver -> assertReachable, in that order, on every call', async () => {
    const { service, assertCanDownload, getFileOrThrow, buildResolver, assertReachable } = buildService({});

    await service.requestAnalysis('room-1', 'file-1', ACTOR);

    expect(assertCanDownload).toHaveBeenCalledWith('room-1', ACTOR, undefined);
    expect(getFileOrThrow).toHaveBeenCalledWith('room-1', 'file-1');
    expect(buildResolver).toHaveBeenCalledWith('room-1', ACTOR, 'RP_LIQUIDATOR');
    expect(assertReachable).toHaveBeenCalled();
  });

  it('getLatestAnalysis re-runs the full chain too -- a status poll is not exempt', async () => {
    const { service, assertCanDownload, assertReachable } = buildService({ latestAnalysis: null });

    await service.getLatestAnalysis('room-1', 'file-1', ACTOR);

    expect(assertCanDownload).toHaveBeenCalled();
    expect(assertReachable).toHaveBeenCalled();
  });

  it('a room the actor cannot download in rejects before any file lookup -- hidden existence preserved', async () => {
    const assertCanDownload = jest.fn().mockRejectedValue(new NotFoundException('Data room not found'));
    const { service, getFileOrThrow } = buildService({ assertCanDownload });

    await expect(service.requestAnalysis('room-1', 'file-1', ACTOR)).rejects.toThrow('Data room not found');
    expect(getFileOrThrow).not.toHaveBeenCalled();
  });

  it('a file outside the actor\'s reachable folders is denied with the generic "File not found" -- never reveals the PDF check ran', async () => {
    const assertReachable = jest.fn().mockRejectedValue(new NotFoundException('File not found'));
    const { service } = buildService({ assertReachable });

    await expect(service.requestAnalysis('room-1', 'file-1', ACTOR)).rejects.toThrow('File not found');
  });

  it('rejects a non-PDF file -- but only AFTER reachability is confirmed, never before', async () => {
    const { service, assertReachable } = buildService({ file: { ...PDF_FILE, extension: 'docx' } });

    await expect(service.requestAnalysis('room-1', 'file-1', ACTOR)).rejects.toThrow(BadRequestException);
    expect(assertReachable).toHaveBeenCalled();
  });
});

describe('DocumentAnalysisService.requestAnalysis', () => {
  it('rejects a file with no uploaded version', async () => {
    const { service } = buildService({ file: { ...PDF_FILE, currentVersionId: null } });
    await expect(service.requestAnalysis('room-1', 'file-1', ACTOR)).rejects.toThrow('no uploaded version');
  });

  it('rejects a file larger than the configured max analysis size', async () => {
    const { service } = buildService({ file: { ...PDF_FILE, sizeBytes: 500 * 1024 * 1024 }, maxFileSizeBytes: 200 * 1024 * 1024 });
    await expect(service.requestAnalysis('room-1', 'file-1', ACTOR)).rejects.toThrow(BadRequestException);
  });

  it('returns the existing row and enqueues nothing new when one is already PENDING/PROCESSING for this file version', async () => {
    const existing = { id: 'analysis-existing', status: DocumentAnalysisStatus.PROCESSING };
    const { service, queueAdd, create } = buildService({ existingAnalysis: existing });

    const result = await service.requestAnalysis('room-1', 'file-1', ACTOR);

    expect(result).toBe(existing);
    expect(queueAdd).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('increments analysisVersion and marks isRegeneration=true when a prior (non-active) analysis exists', async () => {
    const { service, create, record } = buildService({
      existingAnalysis: null,
      latestAnalysis: { id: 'old', analysisVersion: 3, status: DocumentAnalysisStatus.COMPLETED },
    });

    await service.requestAnalysis('room-1', 'file-1', ACTOR);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ analysisVersion: 4 }) }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ isRegeneration: true }) }));
  });

  it('starts at analysisVersion=1 with isRegeneration=false for a genuinely first request', async () => {
    const { service, create, record, queueAdd } = buildService({ existingAnalysis: null, latestAnalysis: null });

    const analysis = await service.requestAnalysis('room-1', 'file-1', ACTOR);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ analysisVersion: 1 }) }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ isRegeneration: false }) }));
    expect(queueAdd).toHaveBeenCalledWith('analyze', { documentAnalysisId: analysis.id }, expect.objectContaining({ jobId: analysis.id }));
  });

  it('captures the FileVersion checksum as originalChecksum at request time, not a placeholder', async () => {
    const { service, create } = buildService({ existingAnalysis: null, latestAnalysis: null });
    await service.requestAnalysis('room-1', 'file-1', ACTOR);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ originalChecksum: VERSION.checksum }) }));
  });

  it("CONCURRENCY: a losing request that races another onto the same (fileId, fileVersionId, analysisVersion) returns the winner's row instead of a raw 500 -- found via Phase 3B.1 live testing", async () => {
    // The re-fetch-after-conflict query has no `status`/`id` key in its
    // where clause, so it routes through the `latestAnalysis` override --
    // same shape as the existing "regeneration" lookup elsewhere in this
    // service.
    const winnerRow = { id: 'winner-analysis', analysisVersion: 1, status: DocumentAnalysisStatus.PENDING };
    const { service, create, queueAdd } = buildService({
      existingAnalysis: null,
      latestAnalysis: winnerRow,
    });
    create.mockImplementationOnce(() => {
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    });

    const result = await service.requestAnalysis('room-1', 'file-1', ACTOR);

    expect(result).toEqual(winnerRow);
    // The loser must never enqueue its own duplicate job -- the winner's
    // own request already did that.
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('CONCURRENCY: a create() failure for any other reason still propagates as a real error, not silently swallowed', async () => {
    const { service, create } = buildService({ existingAnalysis: null, latestAnalysis: null });
    create.mockImplementationOnce(() => {
      throw new Error('a genuine, unrelated database error');
    });

    await expect(service.requestAnalysis('room-1', 'file-1', ACTOR)).rejects.toThrow('a genuine, unrelated database error');
  });
});

describe('DocumentAnalysisService.retryAnalysis / cancelAnalysis', () => {
  it('retry rejects an analysis that is not FAILED', async () => {
    const { service } = buildService({ analysisById: { id: 'a1', status: DocumentAnalysisStatus.COMPLETED } });
    await expect(service.retryAnalysis('room-1', 'file-1', 'a1', ACTOR)).rejects.toThrow(ConflictException);
  });

  it('retry re-enqueues a FAILED analysis under a distinct jobId and audits DOCUMENT_ANALYSIS_RETRIED', async () => {
    const { service, queueAdd, record } = buildService({
      analysisById: { id: 'a1', status: DocumentAnalysisStatus.FAILED },
    });

    await service.retryAnalysis('room-1', 'file-1', 'a1', ACTOR);

    expect(queueAdd).toHaveBeenCalledWith('analyze', { documentAnalysisId: 'a1' }, expect.objectContaining({ jobId: expect.stringContaining('a1') }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'DOCUMENT_ANALYSIS_RETRIED' }));
  });

  it('cancel rejects an analysis that is already terminal (COMPLETED/FAILED/CANCELLED)', async () => {
    const { service } = buildService({ analysisById: { id: 'a1', status: DocumentAnalysisStatus.COMPLETED } });
    await expect(service.cancelAnalysis('room-1', 'file-1', 'a1', ACTOR)).rejects.toThrow(ConflictException);
  });

  it('cancel accepts PENDING or PROCESSING, removes the queued job, and audits DOCUMENT_ANALYSIS_CANCELLED', async () => {
    const { service, getJob, record } = buildService({
      analysisById: { id: 'a1', status: DocumentAnalysisStatus.PROCESSING },
    });

    await service.cancelAnalysis('room-1', 'file-1', 'a1', ACTOR);

    expect(getJob).toHaveBeenCalledWith('a1');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'DOCUMENT_ANALYSIS_CANCELLED' }));
  });

  it('retry/cancel 404 on an analysisId that does not belong to this file/room, never a different error', async () => {
    const { service } = buildService({ analysisById: null });
    await expect(service.retryAnalysis('room-1', 'file-1', 'nonexistent', ACTOR)).rejects.toThrow(NotFoundException);
    await expect(service.cancelAnalysis('room-1', 'file-1', 'nonexistent', ACTOR)).rejects.toThrow(NotFoundException);
  });
});

describe('DocumentAnalysisService -- view auditing', () => {
  it('getLatestAnalysis returns null (and audits nothing) when no analysis exists yet -- not an error', async () => {
    const { service, record } = buildService({ latestAnalysis: null });
    const result = await service.getLatestAnalysis('room-1', 'file-1', ACTOR);
    expect(result).toBeNull();
    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'DOCUMENT_ANALYSIS_VIEWED' }));
  });

  it('getLatestAnalysis audits DOCUMENT_ANALYSIS_VIEWED on every fetch of an existing analysis, not just the first', async () => {
    const { service, record } = buildService({
      latestAnalysis: { id: 'a1', analysisVersion: 1, status: DocumentAnalysisStatus.COMPLETED },
      analysisById: { id: 'a1', analysisVersion: 1, status: DocumentAnalysisStatus.COMPLETED },
    });

    await service.getLatestAnalysis('room-1', 'file-1', ACTOR);
    await service.getLatestAnalysis('room-1', 'file-1', ACTOR);

    const viewedCalls = (record as jest.Mock).mock.calls.filter(([arg]) => arg.action === 'DOCUMENT_ANALYSIS_VIEWED');
    expect(viewedCalls).toHaveLength(2);
  });

  it('getAnalysisById 404s on an id outside this file/room rather than falling through to any other analysis', async () => {
    const { service } = buildService({ analysisById: null });
    await expect(service.getAnalysisById('room-1', 'file-1', 'other-rooms-analysis', ACTOR)).rejects.toThrow(NotFoundException);
  });

  it('never includes extracted sentence text, only structured fields, in a VIEWED audit record', async () => {
    const { service, record } = buildService({
      latestAnalysis: { id: 'a1', analysisVersion: 1, status: DocumentAnalysisStatus.COMPLETED },
      analysisById: { id: 'a1', analysisVersion: 1, status: DocumentAnalysisStatus.COMPLETED },
    });

    await service.getLatestAnalysis('room-1', 'file-1', ACTOR);

    const viewedCall = (record as jest.Mock).mock.calls.find(([arg]) => arg.action === 'DOCUMENT_ANALYSIS_VIEWED');
    expect(Object.keys(viewedCall[0].metadata)).toEqual(['analysisId', 'status']);
  });
});
