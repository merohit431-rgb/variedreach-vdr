import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File, UserRole } from '@prisma/client';
import { getFileTypeRule } from '../../common/constants/file-type-rules';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { FoldersService } from '../folders/folders.service';
import { WatermarkService } from '../watermark/watermark.service';
import { MailService } from '../mail/mail.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { UpdateFileDto } from './dto/update-file.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { StorageWarningLevel } from '../mail/templates/storage-warning.template';

const STORAGE_ALERT_ORG_WIDE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

export interface WatermarkedContent {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly foldersService: FoldersService,
    private readonly auditLogService: AuditLogService,
    private readonly watermarkService: WatermarkService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async list(dataRoomId: string, actor: AuthenticatedUser, query: ListFilesQueryDto) {
    await this.dataRoomAccess.getAccess(dataRoomId, actor);

    return this.prisma.file.findMany({
      where: {
        dataRoomId,
        deletedAt: null,
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : { folderId: query.folderId ?? null }),
      },
      include: { currentVersion: true },
      orderBy: { name: 'asc' },
    });
  }

  async upload(
    dataRoomId: string,
    multerFiles: Express.Multer.File[],
    folderId: string | undefined,
    relativePaths: string[] | undefined,
    actor: AuthenticatedUser,
  ): Promise<File[]> {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);

    if (!multerFiles || multerFiles.length === 0) {
      throw new BadRequestException('No files were uploaded');
    }

    if (folderId) {
      await this.assertFolderExists(dataRoomId, folderId);
    }

    const created: File[] = [];

    for (let index = 0; index < multerFiles.length; index += 1) {
      const multerFile = multerFiles[index];
      const relativePath = relativePaths?.[index];
      const segments = relativePath ? relativePath.split('/').filter(Boolean) : [];
      const fileName = segments.pop() ?? multerFile.originalname;
      const extension = this.extractExtension(fileName);

      const rule = getFileTypeRule(extension);
      if (!rule) {
        throw new BadRequestException(`"${fileName}" has an unsupported file type (.${extension})`);
      }
      if (multerFile.size > rule.maxSizeBytes) {
        throw new BadRequestException(
          `"${fileName}" exceeds the ${Math.round(rule.maxSizeBytes / (1024 * 1024))}MB limit for ${rule.category}`,
        );
      }

      const targetFolderId =
        segments.length > 0
          ? await this.foldersService.findOrCreateFolderPath(dataRoomId, folderId ?? null, segments, actor.id)
          : folderId ?? null;

      const saved = await this.storage.save(dataRoomId, fileName, multerFile.buffer);

      const file = await this.prisma.$transaction(async (tx) => {
        const draft = await tx.file.create({
          data: {
            dataRoomId,
            folderId: targetFolderId,
            name: fileName,
            mimeType: multerFile.mimetype || 'application/octet-stream',
            extension,
            sizeBytes: saved.sizeBytes,
            uploadedBy: actor.id,
          },
        });

        const version = await tx.fileVersion.create({
          data: {
            fileId: draft.id,
            versionNumber: 1,
            storagePath: saved.storagePath,
            sizeBytes: saved.sizeBytes,
            mimeType: draft.mimeType,
            checksum: saved.checksum,
            uploadedBy: actor.id,
            comment: 'Initial upload',
          },
        });

        return tx.file.update({ where: { id: draft.id }, data: { currentVersionId: version.id } });
      });

      await this.prisma.dataRoom.update({
        where: { id: dataRoomId },
        data: { storageUsedBytes: { increment: saved.sizeBytes } },
      });

      await this.auditLogService.record({
        action: 'FILE_UPLOADED',
        dataRoomId,
        userId: actor.id,
        resourceType: 'File',
        resourceId: file.id,
        metadata: { name: fileName, sizeBytes: saved.sizeBytes },
      });

      created.push(file);
    }

    await this.checkStorageThreshold(dataRoomId);

    return created;
  }

  async update(dataRoomId: string, fileId: string, dto: UpdateFileDto, actor: AuthenticatedUser) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);
    const file = await this.getFileOrThrow(dataRoomId, fileId);

    const moving = dto.folderId !== undefined && dto.folderId !== file.folderId;
    if (moving && dto.folderId) {
      await this.assertFolderExists(dataRoomId, dto.folderId);
    }

    const updated = await this.prisma.file.update({
      where: { id: file.id },
      data: {
        name: dto.name ?? file.name,
        folderId: dto.folderId === undefined ? file.folderId : dto.folderId,
      },
    });

    await this.auditLogService.record({
      action: moving ? 'FILE_MOVED' : 'FILE_RENAMED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: file.id,
      metadata: { name: updated.name },
    });

    return updated;
  }

  async remove(dataRoomId: string, fileId: string, actor: AuthenticatedUser) {
    await this.dataRoomAccess.assertContentDeleter(dataRoomId, actor);
    const file = await this.getFileOrThrow(dataRoomId, fileId);

    await this.prisma.file.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
    await this.prisma.dataRoom.update({
      where: { id: dataRoomId },
      data: { storageUsedBytes: { decrement: file.sizeBytes } },
    });

    await this.auditLogService.record({
      action: 'FILE_DELETED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: file.id,
      metadata: { name: file.name },
    });

    await this.checkStorageThreshold(dataRoomId);
  }

  async addVersion(
    dataRoomId: string,
    fileId: string,
    multerFile: Express.Multer.File,
    comment: string | undefined,
    actor: AuthenticatedUser,
  ) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);
    const file = await this.getFileOrThrow(dataRoomId, fileId);

    if (file.isLocked) {
      throw new BadRequestException('File is locked and cannot accept a new version');
    }

    const rule = getFileTypeRule(file.extension);
    if (rule && multerFile.size > rule.maxSizeBytes) {
      throw new BadRequestException(
        `New version exceeds the ${Math.round(rule.maxSizeBytes / (1024 * 1024))}MB limit for ${rule.category}`,
      );
    }

    const saved = await this.storage.save(dataRoomId, file.name, multerFile.buffer);
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: file.id },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const version = await this.prisma.fileVersion.create({
      data: {
        fileId: file.id,
        versionNumber: nextVersionNumber,
        storagePath: saved.storagePath,
        sizeBytes: saved.sizeBytes,
        mimeType: multerFile.mimetype || file.mimeType,
        checksum: saved.checksum,
        uploadedBy: actor.id,
        comment: comment ?? `Version ${nextVersionNumber}`,
      },
    });

    await this.prisma.file.update({
      where: { id: file.id },
      data: { currentVersionId: version.id, sizeBytes: saved.sizeBytes },
    });

    await this.prisma.dataRoom.update({
      where: { id: dataRoomId },
      data: { storageUsedBytes: { increment: BigInt(saved.sizeBytes) - file.sizeBytes } },
    });

    await this.auditLogService.record({
      action: 'FILE_VERSION_UPLOADED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: file.id,
      metadata: { versionNumber: nextVersionNumber },
    });

    await this.checkStorageThreshold(dataRoomId);

    return version;
  }

  async listVersions(dataRoomId: string, fileId: string, actor: AuthenticatedUser) {
    await this.dataRoomAccess.getAccess(dataRoomId, actor);
    await this.getFileOrThrow(dataRoomId, fileId);

    return this.prisma.fileVersion.findMany({ where: { fileId }, orderBy: { versionNumber: 'desc' } });
  }

  async getWatermarkedContent(
    dataRoomId: string,
    fileId: string,
    actor: AuthenticatedUser,
    context: { ipAddress: string; userAgent?: string },
    action: 'FILE_VIEWED' | 'FILE_DOWNLOADED',
    versionId?: string,
  ): Promise<WatermarkedContent> {
    if (action === 'FILE_DOWNLOADED') {
      await this.dataRoomAccess.assertCanDownload(dataRoomId, actor);
    } else {
      await this.dataRoomAccess.getAccess(dataRoomId, actor);
    }
    const file = await this.getFileOrThrow(dataRoomId, fileId);

    const version = versionId
      ? await this.prisma.fileVersion.findFirst({ where: { id: versionId, fileId: file.id } })
      : await this.prisma.fileVersion.findUnique({ where: { id: file.currentVersionId ?? undefined } });

    if (!version) {
      throw new NotFoundException('This file has no content to retrieve');
    }

    const rawBuffer = await this.storage.read(version.storagePath);
    const elements = this.watermarkService.buildElements(actor, context.ipAddress);
    const watermarkedBuffer = await this.watermarkService.apply(rawBuffer, file.extension, elements);

    const auditLog = await this.auditLogService.record({
      action,
      dataRoomId,
      userId: actor.id,
      resourceType: 'File',
      resourceId: file.id,
      metadata: { name: file.name, versionNumber: version.versionNumber },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await this.watermarkService.recordWatermark({
      auditLogId: auditLog.id,
      fileId: file.id,
      fileVersionId: version.id,
      userId: actor.id,
      elements,
    });

    return { buffer: watermarkedBuffer, filename: file.name, mimeType: file.mimeType };
  }

  private async getFileOrThrow(dataRoomId: string, fileId: string): Promise<File> {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, dataRoomId, deletedAt: null } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private async assertFolderExists(dataRoomId: string, folderId: string): Promise<void> {
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, dataRoomId, deletedAt: null } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
  }

  private extractExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  // Event-driven off upload/delete/version changes -- no cron involved.
  // Fires exactly once per upward threshold crossing (highestStorageThresholdNotified
  // tracks the last one emailed) and resets on a downward crossing (e.g.
  // after cleanup) so a future re-crossing alerts again.
  private async checkStorageThreshold(dataRoomId: string): Promise<void> {
    const room = await this.prisma.dataRoom.findUnique({ where: { id: dataRoomId } });
    if (!room) return;

    const limitBytes = BigInt(room.storageLimitGb) * 1024n * 1024n * 1024n;
    const percentUsed = limitBytes > 0n ? Number((room.storageUsedBytes * 100n) / limitBytes) : 0;

    const warningPct = this.configService.get<number>('storage.warningPercent')!;
    const criticalPct = this.configService.get<number>('storage.criticalPercent')!;

    const crossedThreshold =
      percentUsed >= 100 ? 100 : percentUsed >= criticalPct ? criticalPct : percentUsed >= warningPct ? warningPct : 0;

    if (crossedThreshold === room.highestStorageThresholdNotified) {
      return;
    }

    await this.prisma.dataRoom.update({
      where: { id: dataRoomId },
      data: { highestStorageThresholdNotified: crossedThreshold },
    });

    if (crossedThreshold > room.highestStorageThresholdNotified && crossedThreshold > 0) {
      const level: StorageWarningLevel = crossedThreshold === 100 ? 'FULL' : crossedThreshold === criticalPct ? 'CRITICAL' : 'WARNING';
      await this.notifyStorageThreshold(room.id, room.organisationId, room.name, level, percentUsed);
    }
    // Dropping below a threshold (crossedThreshold < previous) just resets
    // the tracker, quietly -- no email for usage going back down.
  }

  private async notifyStorageThreshold(
    dataRoomId: string,
    organisationId: string,
    dataRoomName: string,
    level: StorageWarningLevel,
    percentUsed: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const manageUrl = `${frontendUrl}/data-rooms/${dataRoomId}`;
    const recipients = await this.resolveStorageAlertRecipients(dataRoomId, organisationId);

    for (const recipient of recipients) {
      await this.mailService.sendStorageWarningEmail(recipient.email, level, dataRoomName, percentUsed, manageUrl, {
        userId: recipient.id,
        dataRoomId,
      });
    }
  }

  // Org-wide Org Admins (and Super Admin) + this room's own RP/Liquidator
  // members -- i.e. exactly DATA_ROOM_MANAGER_ROLES, scoped the same way
  // DataRoomAccessService already scopes "manager": org-wide roles see
  // every room, RP_LIQUIDATOR is scoped to rooms they're actually a member of.
  private async resolveStorageAlertRecipients(
    dataRoomId: string,
    organisationId: string,
  ): Promise<Array<{ id: string; email: string }>> {
    const [orgWideUsers, roomMembers] = await Promise.all([
      this.prisma.user.findMany({
        where: { organisationId, role: { in: STORAGE_ALERT_ORG_WIDE_ROLES }, deletedAt: null },
        select: { id: true, email: true },
      }),
      this.prisma.dataRoomMember.findMany({
        where: { dataRoomId, removedAt: null },
        include: { user: { select: { id: true, email: true, role: true } } },
      }),
    ]);

    const rpLiquidatorMembers = roomMembers
      .filter((member) => (member.roleOverride ?? member.user.role) === UserRole.RP_LIQUIDATOR)
      .map((member) => ({ id: member.user.id, email: member.user.email }));

    const byId = new Map<string, { id: string; email: string }>();
    for (const recipient of [...orgWideUsers, ...rpLiquidatorMembers]) {
      byId.set(recipient.id, recipient);
    }

    return Array.from(byId.values());
  }
}
