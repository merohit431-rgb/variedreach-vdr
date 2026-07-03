import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TIME_SLOTS } from './demo-request.dto';

export class CallbackRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[0-9+\-()\s]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ enum: TIME_SLOTS })
  @IsIn(TIME_SLOTS)
  bestTime!: (typeof TIME_SLOTS)[number];

  // Honeypot -- rendered invisibly on the form; real visitors never fill it.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
