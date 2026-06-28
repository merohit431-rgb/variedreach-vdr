import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Audit Logs')
@Controller({ path: 'data-rooms/:dataRoomId/audit-logs', version: '1' })
export class AuditLogsController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  @Get()
  async findAll(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ListAuditLogsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.dataRoomAccess.assertRoomManager(dataRoomId, user);
    return this.auditLogService.findForDataRoom(dataRoomId, query);
  }
}
