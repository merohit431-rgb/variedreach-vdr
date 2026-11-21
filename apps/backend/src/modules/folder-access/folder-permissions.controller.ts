import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FolderPermissionsService } from './folder-permissions.service';
import { GrantFolderAccessDto } from './dto/grant-folder-access.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Folder Access')
@Controller({ path: 'data-rooms/:dataRoomId/folders/:folderId/access', version: '1' })
export class FolderPermissionsController {
  constructor(private readonly folderPermissions: FolderPermissionsService) {}

  @Get()
  list(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.folderPermissions.listAccess(dataRoomId, folderId, user, req.ip ?? '0.0.0.0');
  }

  @Post()
  grant(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Body() dto: GrantFolderAccessDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.folderPermissions.grant(dataRoomId, folderId, dto.userId, user, req.ip ?? '0.0.0.0');
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.folderPermissions.revoke(dataRoomId, folderId, userId, user, req.ip ?? '0.0.0.0');
  }
}
