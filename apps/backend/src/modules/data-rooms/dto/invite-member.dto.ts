import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsIn } from 'class-validator';
import { ASSIGNABLE_MEMBER_ROLES } from '../../../common/constants/content-roles';

export class InviteMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ASSIGNABLE_MEMBER_ROLES })
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role!: UserRole;
}
