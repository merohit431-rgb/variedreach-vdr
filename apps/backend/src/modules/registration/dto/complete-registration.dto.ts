import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { NormalizeEmail } from '../../../common/utils/email.util';

export class CompleteRegistrationDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  gatewayOrderId!: string;

  @ApiProperty()
  @IsString()
  gatewayPaymentId!: string;

  @ApiProperty()
  @IsString()
  gatewaySignature!: string;
}
