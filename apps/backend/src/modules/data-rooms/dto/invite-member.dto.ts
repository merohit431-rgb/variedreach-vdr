import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ASSIGNABLE_MEMBER_ROLES } from '../../../common/constants/content-roles';
import { NormalizeEmail } from '../../../common/utils/email.util';

export class InviteMemberDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ASSIGNABLE_MEMBER_ROLES })
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role!: UserRole;

  // Which client legal entity this person represents in this data room
  // (e.g. a specific subsidiary within a corporate-group case).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientOrganisation?: string;

  // The invitee's own employer/firm (e.g. "Deloitte", "ABC Law Associates").
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
