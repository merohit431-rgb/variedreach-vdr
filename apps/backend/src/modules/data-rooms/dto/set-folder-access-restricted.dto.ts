import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetFolderAccessRestrictedDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
