import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DocumentAnalysisService } from './document-analysis.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

// Every route here independently re-runs the full authorization chain inside
// DocumentAnalysisService -- see that file's header comment. Generation is
// throttled more tightly than ordinary reads, mirroring the reasoning
// already used for download-original: a deliberate, expensive action, far
// less frequent than routine access.
@ApiTags('Document Analysis')
@Controller({ path: 'data-rooms/:dataRoomId/files/:fileId/analysis', version: '1' })
export class DocumentAnalysisController {
  constructor(private readonly documentAnalysisService: DocumentAnalysisService) {}

  @Throttle({ global: { ttl: 300, limit: 10 } })
  @Post()
  request(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documentAnalysisService.requestAnalysis(dataRoomId, fileId, user, req.ip ?? '0.0.0.0');
  }

  @Get()
  getLatest(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documentAnalysisService.getLatestAnalysis(dataRoomId, fileId, user, req.ip ?? '0.0.0.0');
  }

  @Get(':analysisId')
  getOne(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Param('analysisId') analysisId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documentAnalysisService.getAnalysisById(dataRoomId, fileId, analysisId, user, req.ip ?? '0.0.0.0');
  }

  @Throttle({ global: { ttl: 300, limit: 10 } })
  @Post(':analysisId/retry')
  retry(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Param('analysisId') analysisId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documentAnalysisService.retryAnalysis(dataRoomId, fileId, analysisId, user, req.ip ?? '0.0.0.0');
  }

  @Delete(':analysisId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @Param('dataRoomId') dataRoomId: string,
    @Param('fileId') fileId: string,
    @Param('analysisId') analysisId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documentAnalysisService.cancelAnalysis(dataRoomId, fileId, analysisId, user, req.ip ?? '0.0.0.0');
  }
}
