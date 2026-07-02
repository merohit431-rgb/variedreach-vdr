import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class CompleteRegistrationDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
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
