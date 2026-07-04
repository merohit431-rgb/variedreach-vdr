import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { UploadFilesDto } from './dto/upload-files.dto';
import { AddVersionDto } from './dto/add-version.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { sendFileResponse } from '../../common/utils/http-file-response.util';

const MAX_FILES_PER_UPLOAD = 50;

// Same volume as STORAGE_LOCAL_PATH's permanent storage (not the OS's /tmp)
// so LocalStorageProvider's rename() is an atomic move on one filesystem,
// not a slow cross-device copy of a multi-GB file.
const UPLOAD_TEMP_DIR = join(process.env.STORAGE_LOCAL_PATH || './uploads', 'tmp');
const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.STORAGE_MAX_FILE_SIZE_BYTES || `${2 * 1024 * 1024 * 1024}`, 10);

// Uploads stream straight to disk instead of buffering in memory -- a 2GB
// file fully buffered would blow well past the backend container's memory
// limit. multer doesn't create its destination directory on its own.
const uploadDiskStorage = diskStorage({
  destination: (_req, _file, callback) => {
    mkdir(UPLOAD_TEMP_DIR, { recursive: true })
      .then(() => callback(null, UPLOAD_TEMP_DIR))
      .catch((error) => callback(error, UPLOAD_TEMP_DIR));
  },
});

@ApiTags('Files')
@Controller({ path: 'data-rooms/:dataRoomId/files', version: '1' })
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  list(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ListFilesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.list(dataRoomId, user, query);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
      storage: uploadDiskStorage,
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  upload(
    @Param('dataRoomId') dataRoomId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFilesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const relativePaths = this.parseRelativePaths(dto.relativePaths, files?.length ?? 0);
    return this.filesService.upload(dataRoomId, files, dto.folderId, relativePaths, user);
  }

  @Patch(':fileId')
  update(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Body() dto: UpdateFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.update(dataRoomId, fileId, dto, user);
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.remove(dataRoomId, fileId, user);
  }

  @Post(':fileId/versions')
  @UseInterceptors(
    FileInterceptor('file', { storage: uploadDiskStorage, limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }),
  )
  addVersion(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.addVersion(dataRoomId, fileId, file, dto.comment, user);
  }

  @Get(':fileId/versions')
  listVersions(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.listVersions(dataRoomId, fileId, user);
  }

  @Get(':fileId/preview')
  async preview(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const content = await this.filesService.getWatermarkedContent(
      dataRoomId,
      fileId,
      user,
      { ipAddress: req.ip ?? '0.0.0.0', userAgent: req.headers['user-agent'] },
      'FILE_VIEWED',
    );
    sendFileResponse(res, content, 'inline');
  }

  @Get(':fileId/download')
  async download(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const content = await this.filesService.getWatermarkedContent(
      dataRoomId,
      fileId,
      user,
      { ipAddress: req.ip ?? '0.0.0.0', userAgent: req.headers['user-agent'] },
      'FILE_DOWNLOADED',
    );
    sendFileResponse(res, content, 'attachment');
  }

  @Get(':fileId/versions/:versionId/download')
  async downloadVersion(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const content = await this.filesService.getWatermarkedContent(
      dataRoomId,
      fileId,
      user,
      { ipAddress: req.ip ?? '0.0.0.0', userAgent: req.headers['user-agent'] },
      'FILE_DOWNLOADED',
      versionId,
    );
    sendFileResponse(res, content, 'attachment');
  }

  private parseRelativePaths(raw: string | undefined, fileCount: number): string[] | undefined {
    if (!raw) return undefined;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('relativePaths must be a JSON-encoded array of strings');
    }

    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      throw new BadRequestException('relativePaths must be a JSON-encoded array of strings');
    }
    if (parsed.length !== fileCount) {
      throw new BadRequestException('relativePaths length must match the number of uploaded files');
    }

    return parsed;
  }
}
