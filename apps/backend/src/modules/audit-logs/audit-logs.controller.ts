import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Audit Logs')
@Controller({ path: 'data-rooms/:dataRoomId/audit-logs', version: '1' })
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ListAuditLogsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditLogsService.findForDataRoom(dataRoomId, query, user);
  }
}
