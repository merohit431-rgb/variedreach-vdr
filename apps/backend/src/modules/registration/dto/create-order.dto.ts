import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'YEARLY'] })
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}
