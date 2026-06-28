import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({ description: 'List files directly inside this folder (omit for data room root)' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Search file names across the whole data room' })
  @IsOptional()
  @IsString()
  search?: string;
}
