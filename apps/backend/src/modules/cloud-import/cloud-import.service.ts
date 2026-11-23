import { BadRequestException, Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { rm } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { FilesService } from '../files/files.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { ImportGoogleFileDto, ImportOneDriveFileDto } from './dto/import-file.dto';

// Phase 4 security finding: dto.downloadUrl is client-supplied with no host
// validation at all -- before this fix, an attacker could point it at an
// internal service or a cloud metadata endpoint (e.g.
// http://169.254.169.254/...), and the fetched response body would be
// streamed straight into the Data Room as a "file", turning a blind SSRF
// into a data-exfiltration/credential-theft primitive. Microsoft's Graph API
// genuinely does hand back a "pre-authenticated" download URL on one of
// these domains for a real OneDrive/SharePoint file -- allowlisting them
// (and requiring https) is the standard SSRF mitigation: reject anything
// that isn't actually a Microsoft-owned download host, rather than trusting
// whatever string the client sends.
const ALLOWED_ONEDRIVE_DOWNLOAD_HOST_SUFFIXES = [
  '.sharepoint.com',
  '.sharepointonline.com',
  '.1drv.com',
  'onedrive.live.com',
  'graph.microsoft.com',
];

function assertSafeOneDriveDownloadUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Invalid download URL');
  }

  if (url.protocol !== 'https:') {
    throw new BadRequestException('Download URL must use https');
  }

  const hostname = url.hostname.toLowerCase();
  const isAllowed = ALLOWED_ONEDRIVE_DOWNLOAD_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.replace(/^\./, '') || hostname.endsWith(suffix),
  );
  if (!isAllowed) {
    throw new BadRequestException('Download URL is not from a recognised Microsoft OneDrive/SharePoint host');
  }

  return url;
}

@Injectable()
export class CloudImportService {
  constructor(
    private readonly filesService: FilesService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  async importGoogleFile(
    dataRoomId: string,
    dto: ImportGoogleFileDto,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor, clientIp);

    const tempPath = path.join(os.tmpdir(), `vdr-import-${crypto.randomUUID()}`);
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(dto.googleFileId)}?alt=media`,
        {
          headers: { Authorization: `Bearer ${dto.accessToken}` },
          signal: AbortSignal.timeout(300_000),
        },
      );
      if (!res.ok || !res.body) {
        throw new BadRequestException(`Google Drive returned HTTP ${res.status} for "${dto.name}"`);
      }

      await pipeline(
        Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
        createWriteStream(tempPath),
      );

      const fakeFile = this.buildFakeMulterFile(tempPath, dto.name, dto.mimeType, dto.sizeBytes);
      const results = await this.filesService.upload(
        dataRoomId,
        [fakeFile],
        dto.folderId,
        dto.relativePath ? [dto.relativePath] : undefined,
        actor,
        clientIp,
      );
      return results[0];
    } finally {
      // Always clean up regardless of success or failure. force:true is safe
      // if the download failed before the file was created.
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  async importOneDriveFile(
    dataRoomId: string,
    dto: ImportOneDriveFileDto,
    actor: AuthenticatedUser,
    clientIp?: string,
  ) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor, clientIp);

    const safeUrl = assertSafeOneDriveDownloadUrl(dto.downloadUrl);

    const tempPath = path.join(os.tmpdir(), `vdr-import-${crypto.randomUUID()}`);
    try {
      // OneDrive pre-authenticated download URLs carry credentials in the URL itself
      // redirect: 'error' is deliberate -- the hostname allowlist above is
      // only meaningful if a redirect from an allowlisted host can't
      // silently hand the request off to an arbitrary, non-allowlisted one
      // (fetch follows redirects by default, which would bypass the check
      // entirely). A genuine OneDrive download URL is expected to serve the
      // file directly, not redirect.
      let res: Response;
      try {
        res = await fetch(safeUrl, {
          signal: AbortSignal.timeout(300_000),
          redirect: 'error',
        });
      } catch {
        throw new BadRequestException(`Could not download "${dto.name}" from OneDrive`);
      }
      if (!res.ok || !res.body) {
        throw new BadRequestException(`OneDrive returned HTTP ${res.status} for "${dto.name}"`);
      }

      await pipeline(
        Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
        createWriteStream(tempPath),
      );

      const fakeFile = this.buildFakeMulterFile(tempPath, dto.name, dto.mimeType, dto.sizeBytes);
      const results = await this.filesService.upload(
        dataRoomId,
        [fakeFile],
        dto.folderId,
        dto.relativePath ? [dto.relativePath] : undefined,
        actor,
        clientIp,
      );
      return results[0];
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  private buildFakeMulterFile(
    tempPath: string,
    name: string,
    mimeType: string,
    sizeBytes: number,
  ): Express.Multer.File {
    return {
      fieldname: 'files',
      originalname: name,
      encoding: '7bit',
      mimetype: mimeType || 'application/octet-stream',
      size: sizeBytes,
      destination: os.tmpdir(),
      filename: path.basename(tempPath),
      path: tempPath,
      buffer: undefined!,
      stream: undefined!,
    };
  }
}
