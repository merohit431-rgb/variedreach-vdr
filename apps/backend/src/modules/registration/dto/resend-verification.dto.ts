import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../../common/utils/email.util';

export class ResendVerificationDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
