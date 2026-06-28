import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsIn } from 'class-validator';
import { ASSIGNABLE_MEMBER_ROLES } from '../../../common/constants/content-roles';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_MEMBER_ROLES })
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role!: UserRole;
}
