import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Exactly one of userId/groupId is required -- enforced explicitly in
// FolderPermissionsController (not expressible cleanly as a declarative
// class-validator rule), not left to the service layer.
export class GrantFolderAccessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;
}
