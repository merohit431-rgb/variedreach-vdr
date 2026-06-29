import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class DownloadQueryDto {
  @ApiPropertyOptional({ enum: ['original', 'watermarked'], default: 'watermarked' })
  @IsOptional()
  @IsIn(['original', 'watermarked'])
  format?: 'original' | 'watermarked';
}
