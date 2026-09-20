import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  userLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  storageLimitGb?: number;

  // Purchased on top of the plan's base storage -- kept separate so a later
  // plan change recomputes storageLimitGb as (new plan base + this) instead
  // of overwriting it.
  @IsOptional()
  @IsInt()
  @Min(0)
  storageAddOnGb?: number;

  @IsOptional()
  @IsString()
  planSlug?: string;
}
