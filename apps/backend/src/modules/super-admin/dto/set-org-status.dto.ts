import { IsIn } from 'class-validator';

const ASSIGNABLE_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;

export class SetOrgStatusDto {
  @IsIn(ASSIGNABLE_STATUSES)
  status!: 'ACTIVE' | 'SUSPENDED';
}
