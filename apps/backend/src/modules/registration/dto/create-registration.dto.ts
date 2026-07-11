import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';
import { NormalizeEmail } from '../../../common/utils/email.util';

const PLAN_IDS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'] as const;

export class CreateRegistrationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(150)
  companyName!: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  mobileNumber!: string;

  @ApiProperty()
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyAddress?: string;

  @ApiProperty({ enum: PLAN_IDS })
  @IsIn(PLAN_IDS)
  selectedPlan!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  selectedStorageGb!: number;
}
