import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({ description: 'List files directly inside this folder (omit for data room root)' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  folderId?: string;

  @ApiPropertyOptional({ description: 'Search file names across the whole data room' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
