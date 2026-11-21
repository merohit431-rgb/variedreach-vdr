import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { DATA_ROOM_MANAGER_ROLES } from '../../common/constants/content-roles';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const DEFAULT_NDA_TEXT = `NON-DISCLOSURE AGREEMENT

By accessing this data room you agree to keep all information confidential and not to disclose it to any third party without prior written consent. All documents are watermarked and access is logged.`;

@Injectable()
export class NdaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  // Uses assertMembership(), not getAccess() -- getAccess() itself enforces
  // the NDA gate this endpoint exists to resolve, which made it impossible
  // for any member to ever discover whether they'd already accepted (or see
  // the NDA text to accept) once NDA was enabled. assertMembership() still
  // fully enforces room membership, IP allowlist and role resolution; it
  // just doesn't also require the NDA to already be satisfied.
  async getStatus(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const { dataRoom, effectiveRole } = await this.dataRoomAccess.assertMembership(dataRoomId, actor, clientIp);

    if (!dataRoom.ndaEnabled) {
      return { enabled: false, text: null, hasAccepted: true };
    }

    // effectiveRole (room-scoped, honors roleOverride), not actor.role --
    // matches exactly what getAccess()'s own NDA gate checks, so this status
    // can never disagree with the actual enforcement.
    if (DATA_ROOM_MANAGER_ROLES.includes(effectiveRole)) {
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
    const { dataRoom } = await this.dataRoomAccess.assertMembership(dataRoomId, actor, ipAddress);

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
