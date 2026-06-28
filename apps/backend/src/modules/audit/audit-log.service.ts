import { Injectable } from '@nestjs/common';
import { AuditAction, AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stableChecksum } from '../../common/utils/crypto.util';
import { ListAuditLogsQueryDto } from '../audit-logs/dto/list-audit-logs-query.dto';

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
// rows, and it never updates or deletes one. Also enforced at the DB level —
// see prisma/sql/append_only_triggers.sql.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<AuditLog> {
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

    return this.prisma.auditLog.create({
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

  async findForDataRoom(dataRoomId: string, query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      dataRoomId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
