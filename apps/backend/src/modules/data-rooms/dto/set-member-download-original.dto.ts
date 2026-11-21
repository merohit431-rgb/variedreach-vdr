import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetMemberDownloadOriginalDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
