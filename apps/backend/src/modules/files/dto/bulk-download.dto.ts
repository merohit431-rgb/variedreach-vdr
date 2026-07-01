import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkDownloadDto {
  @ApiProperty({ type: [String], description: 'IDs of files to include in the ZIP archive' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  fileIds!: string[];
}
