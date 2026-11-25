import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ArchiveService } from './archive.service';
import { FoldersModule } from '../folders/folders.module';

@Module({
  imports: [FoldersModule],
  controllers: [FilesController],
  providers: [FilesService, ArchiveService],
  exports: [FilesService],
})
export class FilesModule {}
