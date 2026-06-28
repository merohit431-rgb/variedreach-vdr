import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFolderDto {
  @ApiPropertyOptional({ description: 'Rename the folder' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Move the folder under a new parent (null/omit for root)' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
