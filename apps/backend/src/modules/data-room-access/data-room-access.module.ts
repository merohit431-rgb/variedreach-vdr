import { Global, Module } from '@nestjs/common';
import { DataRoomAccessService } from './data-room-access.service';

@Global()
@Module({
  providers: [DataRoomAccessService],
  exports: [DataRoomAccessService],
})
export class DataRoomAccessModule {}
