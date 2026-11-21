import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

// Org-wide group management, same tier and route shape as
// OrgMembersController (organisations/:organisationId/members).
@ApiTags('Groups')
@Controller({ path: 'organisations/:organisationId/groups', version: '1' })
@Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  list(@Param('organisationId') organisationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.list(organisationId, user);
  }

  @Get(':groupId')
  getGroup(
    @Param('organisationId') organisationId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.getGroup(organisationId, groupId, user);
  }

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.create(organisationId, dto, user);
  }

  @Patch(':groupId')
  update(
    @Param('organisationId') organisationId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.update(organisationId, groupId, dto, user);
  }

  @Post(':groupId/members')
  addMember(
    @Param('organisationId') organisationId: string,
    @Param('groupId') groupId: string,
    @Body() dto: AddGroupMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.addMember(organisationId, groupId, dto.userId, user);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('organisationId') organisationId: string,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.removeMember(organisationId, groupId, userId, user);
  }
}
