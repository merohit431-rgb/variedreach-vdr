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

  @IsOptional()
  @IsString()
  planSlug?: string;
}
