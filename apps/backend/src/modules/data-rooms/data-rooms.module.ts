import { Module } from '@nestjs/common';
import { DataRoomsController } from './data-rooms.controller';
import { DataRoomsService } from './data-rooms.service';
import { AuthModule } from '../auth/auth.module';
import { FoldersModule } from '../folders/folders.module';

@Module({
  imports: [AuthModule, FoldersModule],
  controllers: [DataRoomsController],
  providers: [DataRoomsService],
  exports: [DataRoomsService],
})
export class DataRoomsModule {}
