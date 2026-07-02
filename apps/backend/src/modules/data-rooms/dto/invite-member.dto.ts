import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { IsEmail, IsIn } from 'class-validator';
import { ASSIGNABLE_MEMBER_ROLES } from '../../../common/constants/content-roles';

export class InviteMemberDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ASSIGNABLE_MEMBER_ROLES })
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role!: UserRole;
}
