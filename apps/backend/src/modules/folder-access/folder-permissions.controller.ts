import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
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
  ) {
    return this.folderPermissions.listAccess(dataRoomId, folderId, user);
  }

  @Post()
  grant(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Body() dto: GrantFolderAccessDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const grantee = this.toGrantee(dto);
    return this.folderPermissions.grant(dataRoomId, folderId, grantee, user, req.ip ?? '0.0.0.0');
  }

  @Delete('users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeUser(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.folderPermissions.revoke(dataRoomId, folderId, { userId }, user, req.ip ?? '0.0.0.0');
  }

  @Delete('groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeGroup(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.folderPermissions.revoke(dataRoomId, folderId, { groupId }, user, req.ip ?? '0.0.0.0');
  }

  private toGrantee(dto: GrantFolderAccessDto): { userId: string } | { groupId: string } {
    if (dto.userId && dto.groupId) {
      throw new BadRequestException('Provide exactly one of userId or groupId, not both');
    }
    if (dto.userId) return { userId: dto.userId };
    if (dto.groupId) return { groupId: dto.groupId };
    throw new BadRequestException('Provide exactly one of userId or groupId');
  }
}
