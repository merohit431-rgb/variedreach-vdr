import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DisableEmailOtpDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
