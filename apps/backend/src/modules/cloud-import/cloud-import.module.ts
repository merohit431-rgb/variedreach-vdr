import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { DataRoomAccessModule } from '../data-room-access/data-room-access.module';
import { CloudImportController } from './cloud-import.controller';
import { CloudImportService } from './cloud-import.service';

@Module({
  imports: [FilesModule, DataRoomAccessModule],
  controllers: [CloudImportController],
  providers: [CloudImportService],
})
export class CloudImportModule {}
