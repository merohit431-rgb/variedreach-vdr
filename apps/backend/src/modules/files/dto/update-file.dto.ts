import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFileDto {
  @ApiPropertyOptional({ description: 'Rename the file' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Move the file under a new folder (null/omit for root)' })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}
