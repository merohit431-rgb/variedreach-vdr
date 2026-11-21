import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataRoomType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDataRoomDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: DataRoomType })
  @IsEnum(DataRoomType)
  type!: DataRoomType;

  // Whether to auto-seed this type's folder template, when one exists.
  // Defaults to true server-side when omitted -- explicit false is the only
  // way to skip it, so existing callers that never heard of this field keep
  // getting today's behaviour (CIRP always seeds) unchanged.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applyTemplate?: boolean;

  // Opt-in, not a default for any type including IPO -- an administrator
  // deliberately turns this on for a room they're about to organise into
  // access-scoped folders. Omitted/false means today's unrestricted
  // room-level behaviour, unchanged.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  folderAccessRestricted?: boolean;

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
}
