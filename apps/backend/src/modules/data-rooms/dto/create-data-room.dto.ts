import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataRoomType, DownloadPolicy } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDataRoomDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: DataRoomType })
  @IsEnum(DataRoomType)
  type!: DataRoomType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: DownloadPolicy })
  @IsOptional()
  @IsEnum(DownloadPolicy)
  downloadPolicy?: DownloadPolicy;
}
