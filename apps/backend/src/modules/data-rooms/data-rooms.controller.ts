import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DataRoomsService } from './data-rooms.service';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.RP_LIQUIDATOR];

@ApiTags('Data Rooms')
@Controller({ path: 'data-rooms', version: '1' })
export class DataRoomsController {
  constructor(private readonly dataRoomsService: DataRoomsService) {}

  @Roles(...MANAGER_ROLES)
  @Post()
  create(@Body() dto: CreateDataRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.findOne(id, user);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDataRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataRoomsService.update(id, dto, user);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.remove(id, user);
  }

  @Roles(...MANAGER_ROLES)
  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.setArchived(id, true, user);
  }

  @Roles(...MANAGER_ROLES)
  @Post(':id/unarchive')
  unarchive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.setArchived(id, false, user);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dataRoomsService.listMembers(id, user);
  }

  @Roles(...MANAGER_ROLES)
  @Post(':id/members/invite')
  inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataRoomsService.inviteMember(id, dto, user);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id/members/:userId')
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataRoomsService.updateMemberRole(id, userId, dto.role, user);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataRoomsService.removeMember(id, userId, user);
  }

  @Roles(...MANAGER_ROLES)
  @Post(':id/members/:userId/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetMemberPassword(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataRoomsService.resetMemberPassword(id, userId, user);
  }
}
