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
