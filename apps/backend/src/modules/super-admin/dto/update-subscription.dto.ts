import { IsDateString, IsIn, IsOptional } from 'class-validator';

const ASSIGNABLE_STATUSES = ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const;

// All fields optional and independently settable -- "extend", "early-expire"
// and "reactivate" from the product's point of view are all just this one
// operation with different values, not different endpoints.
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsDateString()
  currentPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_STATUSES)
  status?: (typeof ASSIGNABLE_STATUSES)[number];
}
