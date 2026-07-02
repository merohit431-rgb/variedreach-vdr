import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFilesDto {
  @ApiPropertyOptional({ description: 'Target parent folder id, omit for data room root' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  folderId?: string;

  @ApiPropertyOptional({
    description:
      'JSON-encoded array, one entry per uploaded file, of its path relative to folderId ' +
      '(e.g. from a browser folder-upload\'s webkitRelativePath). Plain filenames for a flat multi-upload.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  relativePaths?: string;
}
