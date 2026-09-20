import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/utils/email.util';

const PLAN_IDS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'] as const;
const BILLING_CYCLES = ['MONTHLY', 'YEARLY'] as const;

// Invoice/PO-billed onboarding -- Super Admin only. No payment gateway
// involved: the org is provisioned immediately and marked paid on the
// strength of the Super Admin's own action, same as a signed invoice would
// be in any B2B SaaS. Mirrors CreateRegistrationDto's shape and limits
// (same 200GB Int32-overflow bound -- see that DTO's comment; a genuinely
// larger deal still starts here and scales via the existing storage-request
// flow) since it flows into the exact same provisioning transaction.
export class AdminProvisionOrgDto {
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
  @Max(200)
  selectedStorageGb!: number;

  @ApiProperty({ enum: BILLING_CYCLES })
  @IsIn(BILLING_CYCLES)
  billingCycle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  poNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
