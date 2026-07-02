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
  ) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);

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
  ) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);

    const tempPath = path.join(os.tmpdir(), `vdr-import-${crypto.randomUUID()}`);
    try {
      // OneDrive pre-authenticated download URLs carry credentials in the URL itself
      const res = await fetch(dto.downloadUrl, {
        signal: AbortSignal.timeout(300_000),
      });
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
