import { createHash } from 'crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { FolderAccessService } from '../folder-access/folder-access.service';
import type { FoldersService } from '../folders/folders.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { WatermarkService } from '../watermark/watermark.service';
import type { OfficeConversionService } from '../office-conversion/office-conversion.service';
import type { MailService } from '../mail/mail.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../notifications/notification.service';
import type { IStorageService } from '../storage/storage.interface';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const FILE = {
  id: 'file-1',
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  name: 'Original Report.pdf',
  mimeType: 'application/pdf',
  extension: 'pdf',
  currentVersionId: 'version-1',
  deletedAt: null,
};

const ORIGINAL_BUFFER = Buffer.from('the exact original bytes, never watermarked');
const REAL_CHECKSUM = createHash('sha256').update(ORIGINAL_BUFFER).digest('hex');

// Every test in this file predates folder-ACL -- an always-unrestricted
// resolver keeps them exercising exactly what they did before. Folder-ACL
// interaction with getOriginalContent has its own dedicated tests below.
const UNRESTRICTED_FOLDER_ACCESS = {
  buildResolver: jest.fn().mockResolvedValue({
    unrestricted: true,
    canReach: () => true,
    reachableFolderIds: () => new Set<string>(),
  }),
} as unknown as FolderAccessService;

function buildService(opts: {
  version?: unknown;
  storedChecksum?: string;
  assertCanDownloadOriginal?: jest.Mock;
  folderAccess?: FolderAccessService;
}) {
  // 'version' in opts (not ?? ) -- null is a deliberate test value here
  // (no retrievable version), and ?? would treat it as "unset" and fall
  // through to the default, defeating the 404 test below.
  const version =
    'version' in opts
      ? opts.version
      : {
          id: 'version-1',
          versionNumber: 1,
          storagePath: '/storage/room-1/file-1/v1.pdf',
          checksum: opts.storedChecksum ?? REAL_CHECKSUM,
        };

  const assertCanDownloadOriginal =
    opts.assertCanDownloadOriginal ??
    jest.fn().mockResolvedValue({ dataRoom: { id: 'room-1' }, effectiveRole: 'PRA' });
  const fileFindFirst = jest.fn().mockResolvedValue(FILE);
  const versionFindUnique = jest.fn().mockResolvedValue(version);
  const storageRead = jest.fn().mockResolvedValue(ORIGINAL_BUFFER);
  const record = jest.fn().mockResolvedValue({ id: 'audit-1' });
  const watermarkApply = jest.fn();
  const watermarkBuildElements = jest.fn();

  const prisma = {
    file: { findFirst: fileFindFirst },
    fileVersion: { findFirst: jest.fn(), findUnique: versionFindUnique },
  } as unknown as PrismaService;

  const service = new FilesService(
    prisma,
    { assertCanDownloadOriginal } as unknown as DataRoomAccessService,
    opts.folderAccess ?? UNRESTRICTED_FOLDER_ACCESS,
    {} as FoldersService,
    { record } as unknown as AuditLogService,
    { apply: watermarkApply, buildElements: watermarkBuildElements } as unknown as WatermarkService,
    {} as OfficeConversionService,
    {} as MailService,
    {} as ConfigService,
    {} as NotificationService,
    { read: storageRead } as unknown as IStorageService,
  );

  return { service, assertCanDownloadOriginal, fileFindFirst, storageRead, record, watermarkApply, watermarkBuildElements };
}

const ACTOR = { id: 'user-1', organisationId: 'org-1', role: 'SUPER_ADMIN' } as AuthenticatedUser;
const CONTEXT = { ipAddress: '127.0.0.1', userAgent: 'jest' };

// getOriginalContent() is Option B (Download Original): the exact stored
// bytes, gated by the dedicated DOWNLOAD_ORIGINAL permission, structurally
// independent of the watermarking path (Option A / getWatermarkedContent).
describe('FilesService.getOriginalContent', () => {
  it('is gated by assertCanDownloadOriginal, not assertCanDownload -- a rejection short-circuits before any file lookup', async () => {
    const assertCanDownloadOriginal = jest.fn().mockRejectedValue(new ForbiddenException('nope'));
    const { service, fileFindFirst } = buildService({ assertCanDownloadOriginal });

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow(ForbiddenException);
    expect(fileFindFirst).not.toHaveBeenCalled();
  });

  it('returns the exact original buffer, filename and mimeType unmodified, and never touches the watermark service', async () => {
    const { service, watermarkApply, watermarkBuildElements } = buildService({});

    const result = await service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT);

    expect(result.buffer).toBe(ORIGINAL_BUFFER);
    expect(result.filename).toBe('Original Report.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(watermarkApply).not.toHaveBeenCalled();
    expect(watermarkBuildElements).not.toHaveBeenCalled();
  });

  it('records checksumVerified: true with no expected/actual fields when the stored checksum matches', async () => {
    const { service, record } = buildService({ storedChecksum: REAL_CHECKSUM });

    await service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORIGINAL_FILE_DOWNLOADED',
        metadata: expect.objectContaining({ checksumVerified: true }),
      }),
    );
    const metadata = record.mock.calls[0][0].metadata;
    expect(metadata).not.toHaveProperty('expectedChecksum');
    expect(metadata).not.toHaveProperty('actualChecksum');
  });

  it('still serves the file on a checksum mismatch, but records it loudly in the audit metadata rather than blocking', async () => {
    const { service, record } = buildService({ storedChecksum: 'deliberately-wrong-checksum' });

    const result = await service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT);

    expect(result.buffer).toBe(ORIGINAL_BUFFER);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          checksumVerified: false,
          expectedChecksum: 'deliberately-wrong-checksum',
          actualChecksum: REAL_CHECKSUM,
        }),
      }),
    );
  });

  it('404s when the file has no retrievable version', async () => {
    const { service } = buildService({ version: null });

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow(NotFoundException);
    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow(
      'This file has no content to retrieve',
    );
  });
});

// Every rejection path records an ORIGINAL_FILE_DOWNLOAD_DENIED row -- this
// lives inside the service method itself (not the controller), so there is
// no way to reach a denial by calling the API without it being audited.
describe('FilesService.getOriginalContent denial auditing', () => {
  it('audits a missing-permission denial with the real reason and no file context (file never looked up)', async () => {
    const assertCanDownloadOriginal = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('You do not have permission to download the original, unwatermarked file'));
    const { service, record, fileFindFirst } = buildService({ assertCanDownloadOriginal });

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow(ForbiddenException);

    expect(fileFindFirst).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORIGINAL_FILE_DOWNLOAD_DENIED',
        dataRoomId: 'room-1',
        userId: 'user-1',
        resourceType: 'File',
        resourceId: 'file-1',
        metadata: expect.objectContaining({
          outcome: 'DENIED',
          httpStatus: 403,
          reason: 'You do not have permission to download the original, unwatermarked file',
        }),
        ipAddress: '127.0.0.1',
      }),
    );
  });

  it('audits a revoked-permission denial the same way as a never-granted one (same gate, same message)', async () => {
    const assertCanDownloadOriginal = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('You do not have permission to download the original, unwatermarked file'));
    const { service, record } = buildService({ assertCanDownloadOriginal });

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow(ForbiddenException);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORIGINAL_FILE_DOWNLOAD_DENIED', metadata: expect.objectContaining({ httpStatus: 403 }) }),
    );
  });

  it('audits an unauthorized-membership denial with its own distinct reason', async () => {
    const assertCanDownloadOriginal = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('You do not have access to this data room'));
    const { service, record } = buildService({ assertCanDownloadOriginal });

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow(ForbiddenException);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: 'You do not have access to this data room' }),
      }),
    );
  });

  it('audits an invalid-file denial with httpStatus 404 and the fileId param as resourceId', async () => {
    const { service, record, fileFindFirst } = buildService({});
    fileFindFirst.mockResolvedValueOnce(null);

    await expect(service.getOriginalContent('room-1', 'missing-file', ACTOR, CONTEXT)).rejects.toThrow('File not found');

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'missing-file',
        metadata: expect.objectContaining({ httpStatus: 404, reason: 'File not found' }),
      }),
    );
  });

  it('does not record a denial on a successful download', async () => {
    const { service, record } = buildService({});

    await service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT);

    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'ORIGINAL_FILE_DOWNLOAD_DENIED' }));
  });

  it('a failure to WRITE the denial record never masks the real error', async () => {
    const assertCanDownloadOriginal = jest.fn().mockRejectedValue(new ForbiddenException('nope'));
    const { service, record } = buildService({ assertCanDownloadOriginal });
    // The denial-logging call itself fails -- the original ForbiddenException
    // must still be what the caller sees, not an error from the audit write.
    record.mockRejectedValueOnce(new Error('audit db blip'));

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow('nope');
  });
});

// Folder-ACL and DOWNLOAD_ORIGINAL are fully separate checks -- both must
// pass. These tests hold canDownloadOriginal fixed (granted) and vary only
// folder reachability, proving neither check can substitute for the other.
describe('FilesService.getOriginalContent -- folder-ACL is a separate, additional gate', () => {
  it('blocks with "File not found" when DOWNLOAD_ORIGINAL is granted but the file\'s folder is unreachable', async () => {
    const restrictedFolderAccess = {
      buildResolver: jest.fn().mockResolvedValue({ unrestricted: false, canReach: () => false }),
    } as unknown as FolderAccessService;
    const { service, record } = buildService({ folderAccess: restrictedFolderAccess });

    await expect(service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT)).rejects.toThrow('File not found');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORIGINAL_FILE_DOWNLOAD_DENIED', metadata: expect.objectContaining({ reason: 'File not found' }) }),
    );
  });

  it('succeeds when DOWNLOAD_ORIGINAL is granted AND the folder is reachable', async () => {
    const permissiveFolderAccess = {
      buildResolver: jest.fn().mockResolvedValue({ unrestricted: false, canReach: () => true }),
    } as unknown as FolderAccessService;
    const { service } = buildService({ folderAccess: permissiveFolderAccess });

    const result = await service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT);
    expect(result.buffer).toBe(ORIGINAL_BUFFER);
  });

  it('short-circuits to success for an unrestricted room, matching every existing room\'s unchanged behaviour', async () => {
    const canReach = jest.fn().mockReturnValue(false); // deliberately wrong if ever consulted
    const buildResolver = jest.fn().mockResolvedValue({ unrestricted: true, canReach });
    const { service } = buildService({ folderAccess: { buildResolver } as unknown as FolderAccessService });

    const result = await service.getOriginalContent('room-1', 'file-1', ACTOR, CONTEXT);

    expect(result.buffer).toBe(ORIGINAL_BUFFER);
    expect(canReach).not.toHaveBeenCalled(); // unrestricted short-circuits before canReach() is ever reached
  });
});

// Phase 4 fix: notifyUpload() used to decide who to email by querying the
// dead Permission model (nothing in the app ever writes to it), so every
// external-role member was notified about every upload regardless of
// folder-ACL. These tests call the private method directly (uploads's own
// transaction/storage/quota machinery is irrelevant to what's being tested
// here) to confirm it now defers to FolderAccessService.buildBulkResolvers
// and actually respects a denial.
describe('FilesService.notifyUpload -- folder-ACL now actually gates the email, not a dead table', () => {
  const UPLOADED_FILE = { id: 'file-9', folderId: 'folder-restricted', name: 'Board Resolution.pdf' } as unknown as File;

  function buildNotifyService(opts: {
    members: Array<{ userId: string; role: string; organisationId: string }>;
    buildBulkResolvers: jest.Mock;
  }) {
    const dataRoomFindUnique = jest.fn().mockResolvedValue({
      id: 'room-1',
      name: 'Test Room',
      members: opts.members.map((m) => ({
        userId: m.userId,
        roleOverride: null,
        user: { id: m.userId, email: `${m.userId}@test.com`, firstName: m.userId, lastName: 'Member', role: m.role, organisationId: m.organisationId },
      })),
    });
    const folderFindUnique = jest.fn().mockResolvedValue({ path: 'Board Resolutions' });
    const sendDocumentUploadedEmail = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      dataRoom: { findUnique: dataRoomFindUnique },
      folder: { findUnique: folderFindUnique },
    } as unknown as PrismaService;

    const service = new FilesService(
      prisma,
      {} as DataRoomAccessService,
      { buildBulkResolvers: opts.buildBulkResolvers } as unknown as FolderAccessService,
      {} as FoldersService,
      {} as AuditLogService,
      {} as WatermarkService,
      {} as OfficeConversionService,
      { sendDocumentUploadedEmail } as unknown as MailService,
      { get: jest.fn().mockReturnValue('https://staging.vdr.variedreach.com') } as unknown as ConfigService,
      {} as NotificationService,
      {} as IStorageService,
    );
    return { service, sendDocumentUploadedEmail };
  }

  it('does not email an external-role member the bulk resolver says cannot reach the folder', async () => {
    const buildBulkResolvers = jest.fn().mockResolvedValue(
      new Map([
        ['manager-1', { unrestricted: false, canReach: () => true, reachableFolderIds: () => new Set() }],
        ['blocked-reviewer', { unrestricted: false, canReach: () => false, reachableFolderIds: () => new Set() }],
        ['granted-reviewer', { unrestricted: false, canReach: () => true, reachableFolderIds: () => new Set() }],
      ]),
    );
    const { service, sendDocumentUploadedEmail } = buildNotifyService({
      members: [
        { userId: 'manager-1', role: 'RP_LIQUIDATOR', organisationId: 'org-1' },
        { userId: 'blocked-reviewer', role: 'PRA', organisationId: 'org-1' },
        { userId: 'granted-reviewer', role: 'PRA', organisationId: 'org-1' },
      ],
      buildBulkResolvers,
    });

    await (service as unknown as { notifyUpload: (d: string, f: File, a: AuthenticatedUser) => Promise<void> }).notifyUpload(
      'room-1',
      UPLOADED_FILE,
      ACTOR,
    );

    expect(buildBulkResolvers).toHaveBeenCalledWith('room-1', [
      { userId: 'manager-1', organisationId: 'org-1' },
      { userId: 'blocked-reviewer', organisationId: 'org-1' },
      { userId: 'granted-reviewer', organisationId: 'org-1' },
    ]);
    const notifiedEmails = sendDocumentUploadedEmail.mock.calls.map((c) => c[0]);
    expect(notifiedEmails).toContain('manager-1@test.com');
    expect(notifiedEmails).toContain('granted-reviewer@test.com');
    expect(notifiedEmails).not.toContain('blocked-reviewer@test.com');
  });

  it('notifies every external-role member when the room is unrestricted (buildBulkResolvers returns null)', async () => {
    const buildBulkResolvers = jest.fn().mockResolvedValue(null);
    const { service, sendDocumentUploadedEmail } = buildNotifyService({
      members: [{ userId: 'reviewer-1', role: 'PRA', organisationId: 'org-1' }],
      buildBulkResolvers,
    });

    await (service as unknown as { notifyUpload: (d: string, f: File, a: AuthenticatedUser) => Promise<void> }).notifyUpload(
      'room-1',
      UPLOADED_FILE,
      ACTOR,
    );

    expect(sendDocumentUploadedEmail.mock.calls.map((c) => c[0])).toContain('reviewer-1@test.com');
  });
});

// Phase 4 finding P4-05 (High, Phase 3C.3 closure): this endpoint had zero
// test coverage before this fix, and zero pagination -- measured on staging
// at 10,000 files: one 5.65MB/2.65s response. Both are addressed together.
describe('FilesService.list', () => {
  function buildListService(opts: {
    resolver?: { unrestricted: boolean; reachableFolderIds: () => Set<string> };
    findMany?: jest.Mock;
    count?: jest.Mock;
  }) {
    const resolver = opts.resolver ?? { unrestricted: true, reachableFolderIds: () => new Set<string>() };
    const getAccess = jest.fn().mockResolvedValue({ effectiveRole: 'PRA' });
    const buildResolver = jest.fn().mockResolvedValue(resolver);
    const assertReachable = jest.fn().mockResolvedValue(undefined);
    const findMany = opts.findMany ?? jest.fn().mockResolvedValue([]);
    const count = opts.count ?? jest.fn().mockResolvedValue(0);

    const prisma = { file: { findMany, count } } as unknown as PrismaService;
    const service = new FilesService(
      prisma,
      { getAccess } as unknown as DataRoomAccessService,
      { buildResolver, assertReachable } as unknown as FolderAccessService,
      {} as FoldersService,
      {} as AuditLogService,
      {} as WatermarkService,
      {} as OfficeConversionService,
      {} as MailService,
      {} as ConfigService,
      {} as NotificationService,
      {} as IStorageService,
    );
    return { service, findMany, count, assertReachable };
  }

  it('defaults to page 1 / the standard page size when the client sends neither', async () => {
    const { service, findMany } = buildListService({});

    const result = await service.list('room-1', ACTOR, {});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 200 }));
    expect(result.meta).toMatchObject({ page: 1, limit: 200 });
  });

  it('computes skip from an explicit page/limit', async () => {
    const { service, findMany } = buildListService({ count: jest.fn().mockResolvedValue(95) });

    const result = await service.list('room-1', ACTOR, { page: 3, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    expect(result.meta).toEqual({ page: 3, limit: 20, total: 95, totalPages: 5 });
  });

  it('returns {data, meta} -- not a bare array -- for both the folder-scoped and search-scoped query paths', async () => {
    const scoped = buildListService({ count: jest.fn().mockResolvedValue(1) });
    const scopedResult = await scoped.service.list('room-1', ACTOR, { folderId: 'folder-1' });
    expect(scopedResult).toHaveProperty('data');
    expect(scopedResult).toHaveProperty('meta');

    const searched = buildListService({ count: jest.fn().mockResolvedValue(1) });
    const searchResult = await searched.service.list('room-1', ACTOR, { search: 'invoice' });
    expect(searchResult).toHaveProperty('data');
    expect(searchResult).toHaveProperty('meta');
  });

  it('REGRESSION GUARD: a restricted resolver still scopes the paginated search query to reachable folders only', async () => {
    const resolver = { unrestricted: false, reachableFolderIds: () => new Set(['folder-allowed']) };
    const { service, findMany } = buildListService({ resolver });

    await service.list('room-1', ACTOR, { search: 'report', page: 1, limit: 50 });

    const whereArg = findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual([{ folderId: null }, { folderId: { in: ['folder-allowed'] } }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));
  });

  it('REGRESSION GUARD: an unreachable folderId still 404s before any paginated query runs', async () => {
    const { service, assertReachable, findMany } = buildListService({});
    assertReachable.mockRejectedValue(new NotFoundException('Folder not found'));

    await expect(service.list('room-1', ACTOR, { folderId: 'folder-x' })).rejects.toThrow('Folder not found');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('a request for page 2 of a 10,000-file room still only fetches one page\'s worth, not the whole room', async () => {
    const { service, findMany, count } = buildListService({ count: jest.fn().mockResolvedValue(10_000) });

    await service.list('room-1', ACTOR, { page: 2, limit: 200 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 200, take: 200 }));
    expect(count).toHaveBeenCalledTimes(1);
  });
});
