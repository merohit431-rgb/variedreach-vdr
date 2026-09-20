import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OrgMembersService } from './org-members.service';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

// Org-wide member management (every member across every data room in an
// organisation) -- distinct from data-rooms/members, which is scoped to one
// room and also reachable by RP_LIQUIDATOR. Org-wide is Org Admin (own org
// only) and Super Admin (any org) -- see content-roles.ts's note on the
// "Manage Users" tier.
@ApiTags('Organisation Members')
@Controller({ path: 'organisations/:organisationId/members', version: '1' })
@Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
export class OrgMembersController {
  constructor(private readonly orgMembersService: OrgMembersService) {}

  @Get()
  listMembers(@Param('organisationId') organisationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orgMembersService.listMembers(organisationId, user);
  }

  @Patch(':userId/status')
  updateMemberStatus(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgMembersService.updateMemberStatus(organisationId, userId, dto.status, user);
  }
}
