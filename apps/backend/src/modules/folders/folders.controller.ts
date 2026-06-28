import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Folders')
@Controller({ path: 'data-rooms/:dataRoomId/folders', version: '1' })
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  findTree(@Param('dataRoomId') dataRoomId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.foldersService.findTree(dataRoomId, user);
  }

  @Post()
  create(
    @Param('dataRoomId') dataRoomId: string,
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.foldersService.create(dataRoomId, dto, user);
  }

  @Patch(':folderId')
  update(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.foldersService.update(dataRoomId, folderId, dto, user);
  }

  @Delete(':folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('dataRoomId') dataRoomId: string,
    @Param('folderId') folderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.foldersService.remove(dataRoomId, folderId, user);
  }
}
