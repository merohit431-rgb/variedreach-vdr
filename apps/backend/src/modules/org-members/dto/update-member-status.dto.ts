import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const ASSIGNABLE_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AssignableMembershipStatus = (typeof ASSIGNABLE_STATUSES)[number];

export class UpdateMemberStatusDto {
  @ApiProperty({ enum: ASSIGNABLE_STATUSES })
  @IsIn(ASSIGNABLE_STATUSES)
  status!: AssignableMembershipStatus;
}
