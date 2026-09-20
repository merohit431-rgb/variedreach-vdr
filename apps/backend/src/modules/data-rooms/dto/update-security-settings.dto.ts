import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const WATERMARK_POSITIONS = ['diagonal', 'tiled'] as const;

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ipAllowlistEnabled?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'CIDR ranges e.g. ["192.168.1.0/24"]' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ndaEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  ndaText?: string | null;

  @ApiPropertyOptional({ description: 'Watermark text template. Tokens: {{name}} {{email}} {{date}} {{time}} {{ip}}' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  watermarkTemplate?: string;

  // Floor of 0.05, not 0 -- an opacity of 0 would make the watermark
  // invisible, which defeats the traceability the feature exists for.
  @ApiPropertyOptional({ minimum: 0.05, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.05)
  @Max(1)
  watermarkOpacity?: number;

  @ApiPropertyOptional({ enum: WATERMARK_POSITIONS })
  @IsOptional()
  @IsIn(WATERMARK_POSITIONS)
  watermarkPosition?: (typeof WATERMARK_POSITIONS)[number];
}
