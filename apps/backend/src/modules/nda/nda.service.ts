import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const DEFAULT_NDA_TEXT = `NON-DISCLOSURE AGREEMENT

By accessing this data room you agree to keep all information confidential and not to disclose it to any third party without prior written consent. All documents are watermarked and access is logged.`;

const BYPASS_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.RP_LIQUIDATOR];

@Injectable()
export class NdaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  async getStatus(dataRoomId: string, actor: AuthenticatedUser) {
    const { dataRoom } = await this.dataRoomAccess.getAccess(dataRoomId, actor);

    if (!dataRoom.ndaEnabled) {
      return { enabled: false, text: null, hasAccepted: true };
    }

    if (BYPASS_ROLES.includes(actor.role)) {
      return { enabled: true, text: dataRoom.ndaText ?? DEFAULT_NDA_TEXT, hasAccepted: true };
    }

    const acceptance = await this.prisma.ndaAcceptance.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
    });

    return {
      enabled: true,
      text: dataRoom.ndaText ?? DEFAULT_NDA_TEXT,
      hasAccepted: !!acceptance,
    };
  }

  async accept(dataRoomId: string, actor: AuthenticatedUser, ipAddress: string, userAgent?: string) {
    const { dataRoom } = await this.dataRoomAccess.getAccess(dataRoomId, actor);

    if (!dataRoom.ndaEnabled) {
      throw new ForbiddenException('This data room does not require NDA acceptance');
    }

    await this.prisma.ndaAcceptance.upsert({
      where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
      update: { acceptedAt: new Date(), ipAddress, userAgent },
      create: { dataRoomId, userId: actor.id, ipAddress, userAgent },
    });

    await this.auditLogService.record({
      action: 'NDA_ACCEPTED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: dataRoomId,
      ipAddress,
      userAgent,
    });
  }
}
