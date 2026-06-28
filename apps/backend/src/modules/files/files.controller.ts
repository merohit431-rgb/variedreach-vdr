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
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { UploadFilesDto } from './dto/upload-files.dto';
import { AddVersionDto } from './dto/add-version.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const MAX_FILES_PER_UPLOAD = 50;

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
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { storage: memoryStorage() }))
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
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
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
    this.send(res, content, 'inline');
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
    this.send(res, content, 'attachment');
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
    this.send(res, content, 'attachment');
  }

  private send(res: Response, content: { buffer: Buffer; filename: string; mimeType: string }, disposition: 'inline' | 'attachment') {
    const asciiFallback = content.filename.replace(/[^\x20-\x7E]/g, '_');
    res.set({
      'Content-Type': content.mimeType,
      'Content-Disposition': `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(content.filename)}`,
      'Content-Length': content.buffer.length,
    });
    res.send(content.buffer);
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
