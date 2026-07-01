import { Module } from '@nestjs/common';
import { QnaController } from './qna.controller';
import { QnaService } from './qna.service';
import { DataRoomAccessModule } from '../data-room-access/data-room-access.module';

@Module({
  imports: [DataRoomAccessModule],
  controllers: [QnaController],
  providers: [QnaService],
})
export class QnaModule {}
