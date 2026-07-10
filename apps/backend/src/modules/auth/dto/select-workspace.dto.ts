import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SelectWorkspaceDto {
  @ApiProperty()
  @IsString()
  workspaceSelectionToken!: string;

  @ApiProperty()
  @IsString()
  organisationId!: string;
}
