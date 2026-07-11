import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { NormalizeEmail } from '../../../common/utils/email.util';

const PLAN_IDS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'];

export class ValidateCouponDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ enum: PLAN_IDS })
  @IsIn(PLAN_IDS)
  planId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  storageGb!: number;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'YEARLY'] })
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;
}
