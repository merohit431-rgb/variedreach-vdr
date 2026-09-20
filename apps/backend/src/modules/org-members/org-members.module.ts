import { Module } from '@nestjs/common';
import { OrgMembersController } from './org-members.controller';
import { OrgMembersService } from './org-members.service';

@Module({
  controllers: [OrgMembersController],
  providers: [OrgMembersService],
})
export class OrgMembersModule {}
