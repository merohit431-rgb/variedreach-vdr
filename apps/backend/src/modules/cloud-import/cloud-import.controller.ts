import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CloudImportService } from './cloud-import.service';
import { ImportGoogleFileDto, ImportOneDriveFileDto } from './dto/import-file.dto';

@ApiTags('cloud-import')
@Controller('v1/data-rooms/:dataRoomId/cloud-import')
export class CloudImportController {
  constructor(private readonly service: CloudImportService) {}

  @Post('google-drive')
  importFromGoogle(
    @Param('dataRoomId') dataRoomId: string,
    @Body() dto: ImportGoogleFileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.importGoogleFile(dataRoomId, dto, actor);
  }

  @Post('onedrive')
  importFromOneDrive(
    @Param('dataRoomId') dataRoomId: string,
    @Body() dto: ImportOneDriveFileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.importOneDriveFile(dataRoomId, dto, actor);
  }
}
