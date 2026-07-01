import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  userLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  storageLimitGb?: number;

  @IsOptional()
  @IsString()
  planSlug?: string;
}
