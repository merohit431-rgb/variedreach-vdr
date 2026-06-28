import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
