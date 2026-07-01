import { Module } from '@nestjs/common';
import { NdaController } from './nda.controller';
import { NdaService } from './nda.service';
import { DataRoomAccessModule } from '../data-room-access/data-room-access.module';

@Module({
  imports: [DataRoomAccessModule],
  controllers: [NdaController],
  providers: [NdaService],
  exports: [NdaService],
})
export class NdaModule {}
