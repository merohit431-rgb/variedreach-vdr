import { PartialType } from '@nestjs/swagger';
import { CreateDataRoomDto } from './create-data-room.dto';

export class UpdateDataRoomDto extends PartialType(CreateDataRoomDto) {}
