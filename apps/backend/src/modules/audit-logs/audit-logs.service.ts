import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { DATA_ROOM_MANAGER_ROLES } from '../../common/constants/content-roles';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  // Three states, not two: manager tier sees everything in the room (and may
  // filter by any userId), external-but-member roles see only their own
  // activity regardless of what they ask for, non-members never get here at
  // all (getAccess throws 403/404 first). The external branch deliberately
  // overrides query.userId rather than just defaulting it — never trust a
  // client-supplied userId from a non-manager to scope down to themselves
  // "voluntarily."
  async findForDataRoom(dataRoomId: string, query: ListAuditLogsQueryDto, actor: AuthenticatedUser) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor);

    if (DATA_ROOM_MANAGER_ROLES.includes(effectiveRole)) {
      return this.auditLogService.findForDataRoom(dataRoomId, query);
    }

    return this.auditLogService.findForDataRoom(dataRoomId, { ...query, userId: actor.id });
  }
}
