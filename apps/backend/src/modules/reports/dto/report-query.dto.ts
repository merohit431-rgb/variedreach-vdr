import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export const REPORT_FORMATS = ['json', 'csv', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export class ReportQueryDto {
  @ApiPropertyOptional({ enum: REPORT_FORMATS, default: 'json' })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format: ReportFormat = 'json';

  @ApiPropertyOptional({ description: 'ISO date — only events at or after this instant' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — only events at or before this instant' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
