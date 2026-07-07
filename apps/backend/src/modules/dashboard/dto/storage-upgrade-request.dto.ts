import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StorageUpgradeRequestDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  requestedGb!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
