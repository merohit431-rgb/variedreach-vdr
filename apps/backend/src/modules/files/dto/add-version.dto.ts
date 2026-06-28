import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddVersionDto {
  @ApiPropertyOptional({ description: 'Optional note describing what changed in this version' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
