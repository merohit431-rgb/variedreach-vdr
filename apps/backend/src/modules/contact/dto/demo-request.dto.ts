import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/utils/email.util';

export const DEMO_USE_CASES = ['CIRP', 'LIQUIDATION', 'MA_DUE_DILIGENCE', 'OTHER'] as const;
export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;

export const USE_CASE_LABELS: Record<string, string> = {
  CIRP: 'CIRP',
  LIQUIDATION: 'Liquidation',
  MA_DUE_DILIGENCE: 'M&A Due Diligence',
  OTHER: 'Other',
};

export const TIME_SLOT_LABELS: Record<string, string> = {
  MORNING: 'Morning (9am – 12pm)',
  AFTERNOON: 'Afternoon (12pm – 4pm)',
  EVENING: 'Evening (4pm – 7pm)',
};

export class DemoRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(150)
  firmName!: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  workEmail!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[0-9+\-()\s]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiProperty({ enum: DEMO_USE_CASES })
  @IsIn(DEMO_USE_CASES)
  useCase!: (typeof DEMO_USE_CASES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredDate?: string;

  @ApiPropertyOptional({ enum: TIME_SLOTS })
  @IsOptional()
  @IsIn(TIME_SLOTS)
  preferredSlot?: (typeof TIME_SLOTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  // Honeypot -- rendered invisibly on the form; real visitors never fill it.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
