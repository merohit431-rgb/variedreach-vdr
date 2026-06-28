import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stableChecksum } from '../../common/utils/crypto.util';

export interface RecordAuditLogInput {
  action: AuditAction;
  dataRoomId?: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

// Append-only by convention: this is the only place app code writes AuditLog
// rows, and it never updates or deletes one. A DB-level trigger enforcing this
// is added in the Audit Logs module.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    const createdAt = new Date();
    const checksum = stableChecksum({
      action: input.action,
      dataRoomId: input.dataRoomId ?? null,
      userId: input.userId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: createdAt.toISOString(),
    });

    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        dataRoomId: input.dataRoomId,
        userId: input.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        createdAt,
        checksum,
      },
    });
  }
}
