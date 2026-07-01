import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { NdaService } from './nda.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('NDA')
@Controller({ path: 'data-rooms/:dataRoomId/nda', version: '1' })
export class NdaController {
  constructor(private readonly ndaService: NdaService) {}

  @Get()
  getStatus(
    @Param('dataRoomId') dataRoomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ndaService.getStatus(dataRoomId, user);
  }

  @Post('accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(
    @Param('dataRoomId') dataRoomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.ndaService.accept(dataRoomId, user, req.ip ?? '0.0.0.0', req.headers['user-agent']);
  }
}
