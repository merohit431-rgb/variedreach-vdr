import { Global, Module } from '@nestjs/common';
import { FolderAccessService } from './folder-access.service';
import { FolderPermissionsService } from './folder-permissions.service';
import { FolderPermissionsController } from './folder-permissions.controller';

@Global()
@Module({
  controllers: [FolderPermissionsController],
  providers: [FolderAccessService, FolderPermissionsService],
  exports: [FolderAccessService],
})
export class FolderAccessModule {}
