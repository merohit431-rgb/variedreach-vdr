import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CopyFolderDto {
  @ApiPropertyOptional({ description: 'Destination parent folder id, omit for the data room root' })
  @IsOptional()
  @IsString()
  targetParentId?: string;
}
