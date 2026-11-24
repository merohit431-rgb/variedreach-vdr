import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Phase 4 finding P4-05 (High): this endpoint had no pagination at all --
// measured on staging at 10,000 files: 2.65s and 5.65MB for one response.
// DEFAULT_LIMIT keeps today's typical small/medium rooms rendering
// identically to before (nothing paginates away unless a room actually has
// more files than that); MAX_LIMIT is the real fix -- it bounds the worst
// case by construction, even for a client that never asks for a smaller
// page, closing the unbounded-response-size problem outright.
export const FILES_DEFAULT_LIMIT = 200;
export const FILES_MAX_LIMIT = 500;

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

  @ApiPropertyOptional({ description: '1-indexed page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: `Results per page (max ${FILES_MAX_LIMIT})`, default: FILES_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FILES_MAX_LIMIT)
  limit?: number = FILES_DEFAULT_LIMIT;
}
