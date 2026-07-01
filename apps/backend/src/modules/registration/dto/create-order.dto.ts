import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'YEARLY'] })
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle?: string;
}
