import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question!: string;

  @ApiPropertyOptional({ description: 'Private questions are visible only to you and room managers' })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description:
      'Folder this question concerns. Omit for a room-general question. When folder access is ' +
      'restricted, you must already be able to reach this folder yourself.',
  })
  @IsOptional()
  @IsString()
  folderId?: string;
}
