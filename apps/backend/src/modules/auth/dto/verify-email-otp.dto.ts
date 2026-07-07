import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class VerifyEmailOtpDto {
  @ApiProperty()
  @IsString()
  mfaChallengeToken!: string;

  @ApiProperty({ description: '6-digit code sent by email' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @ApiPropertyOptional({ description: 'Skip the OTP challenge on this browser for 30 days' })
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
