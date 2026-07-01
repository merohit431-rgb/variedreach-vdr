import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CompleteRegistrationDto {
  @ApiProperty()
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
