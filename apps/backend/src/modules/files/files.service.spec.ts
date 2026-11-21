import { createHash } from 'crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
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

function buildService(opts: {
  version?: unknown;
  storedChecksum?: string;
  assertCanDownloadOriginal?: jest.Mock;
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
    opts.assertCanDownloadOriginal ?? jest.fn().mockResolvedValue({ dataRoom: { id: 'room-1' } });
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
