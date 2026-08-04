import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
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

  // 200GB keeps every current plan/billing-cycle combination's total (paisa,
  // an Int32 DB column) comfortably under 2,147,483,647 -- the tightest
  // case, Starter yearly, only clears ~398GB before overflowing. A customer
  // who genuinely needs more than this buys in and scales up afterwards via
  // the existing storage-increase request flow (dashboard.service.ts
  // requestStorageUpgrade) rather than through self-service signup.
  // Re-derive this bound before ever raising it or adding a higher-rate plan.
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(200)
  selectedStorageGb!: number;
}
