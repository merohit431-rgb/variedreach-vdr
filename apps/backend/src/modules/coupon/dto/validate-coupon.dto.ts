import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  email?: string;
}
