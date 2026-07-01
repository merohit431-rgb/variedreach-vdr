import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class VerifyMfaLoginDto {
  @ApiProperty()
  @IsString()
  mfaChallengeToken!: string;

  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6)
  totpCode!: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
