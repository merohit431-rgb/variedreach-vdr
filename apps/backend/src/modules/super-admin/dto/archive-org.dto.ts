import { IsString, MinLength } from 'class-validator';

export class ArchiveOrgDto {
  // The Super Admin must type the organisation's exact current name --
  // server-side, not just a frontend gate, since this is the one genuinely
  // hard-to-reverse action this module exposes.
  @IsString()
  @MinLength(1)
  confirmName!: string;
}
