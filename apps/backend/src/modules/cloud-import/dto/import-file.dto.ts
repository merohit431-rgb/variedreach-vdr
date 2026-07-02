import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ImportGoogleFileDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(127)
  mimeType: string;

  @IsNumber()
  @Min(0)
  @Max(2 * 1024 * 1024 * 1024)
  sizeBytes: number;

  @IsString()
  @MaxLength(256)
  googleFileId: string;

  @IsString()
  @MaxLength(2048)
  accessToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  relativePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  folderId?: string;
}

export class ImportOneDriveFileDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(127)
  mimeType: string;

  @IsNumber()
  @Min(0)
  @Max(2 * 1024 * 1024 * 1024)
  sizeBytes: number;

  @IsString()
  @MaxLength(2048)
  downloadUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  relativePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  folderId?: string;
}
