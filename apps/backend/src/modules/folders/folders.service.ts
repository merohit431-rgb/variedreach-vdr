import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Folder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CopyFolderDto } from './dto/copy-folder.dto';
import { CIRP_DEFAULT_FOLDERS } from './cirp-folder-template';

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataRoomAccess: DataRoomAccessService,
    private readonly auditLogService: AuditLogService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async findTree(dataRoomId: string, actor: AuthenticatedUser) {
    await this.dataRoomAccess.getAccess(dataRoomId, actor);

    return this.prisma.folder.findMany({
      where: { dataRoomId, deletedAt: null },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dataRoomId: string, dto: CreateFolderDto, actor: AuthenticatedUser) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);

    const parent = dto.parentId ? await this.getFolderOrThrow(dataRoomId, dto.parentId) : null;
    const siblingCount = await this.prisma.folder.count({
      where: { dataRoomId, parentId: parent?.id ?? null, deletedAt: null },
    });

    const folder = await this.prisma.folder.create({
      data: {
        dataRoomId,
        parentId: parent?.id ?? null,
        name: dto.name,
        path: this.buildPath(parent, dto.name),
        depth: parent ? parent.depth + 1 : 0,
        sortOrder: siblingCount,
        createdBy: actor.id,
      },
    });

    await this.auditLogService.record({
      action: 'FOLDER_CREATED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folder.id,
      metadata: { name: folder.name },
    });

    return folder;
  }

  async update(dataRoomId: string, folderId: string, dto: UpdateFolderDto, actor: AuthenticatedUser) {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);

    const folder = await this.getFolderOrThrow(dataRoomId, folderId);
    const renaming = dto.name !== undefined && dto.name !== folder.name;
    const moving = dto.parentId !== undefined && dto.parentId !== folder.parentId;

    let newParent: Folder | null = null;

    if (moving) {
      newParent = dto.parentId ? await this.getFolderOrThrow(dataRoomId, dto.parentId) : null;

      if (newParent && (await this.isDescendant(dataRoomId, folder.id, newParent.id))) {
        throw new BadRequestException('Cannot move a folder into its own subtree');
      }
    } else if (folder.parentId) {
      newParent = await this.prisma.folder.findUnique({ where: { id: folder.parentId } });
    }

    const newName = dto.name ?? folder.name;
    const newPath = this.buildPath(newParent, newName);
    const newDepth = newParent ? newParent.depth + 1 : 0;

    const updated = await this.prisma.folder.update({
      where: { id: folder.id },
      data: {
        name: newName,
        parentId: newParent?.id ?? null,
        path: newPath,
        depth: newDepth,
      },
    });

    if (moving || renaming) {
      await this.rebuildDescendantPaths(updated);
    }

    await this.auditLogService.record({
      action: moving ? 'FOLDER_MOVED' : 'FOLDER_RENAMED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folder.id,
      metadata: { name: newName },
    });

    return updated;
  }

  async remove(dataRoomId: string, folderId: string, actor: AuthenticatedUser) {
    await this.dataRoomAccess.assertContentDeleter(dataRoomId, actor);

    const folder = await this.getFolderOrThrow(dataRoomId, folderId);

    const [childCount, fileCount] = await Promise.all([
      this.prisma.folder.count({ where: { parentId: folder.id, deletedAt: null } }),
      this.prisma.file.count({ where: { folderId: folder.id, deletedAt: null } }),
    ]);

    if (childCount > 0 || fileCount > 0) {
      throw new BadRequestException('Folder is not empty — delete its contents first');
    }

    await this.prisma.folder.update({ where: { id: folder.id }, data: { deletedAt: new Date() } });

    await this.auditLogService.record({
      action: 'FOLDER_DELETED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: folder.id,
      metadata: { name: folder.name },
    });
  }

  // Duplicates a folder and everything beneath it (subfolders, files) into a
  // new location. Only the current version of each file is copied -- a copy
  // gives you the document as it stands today, not its whole edit history.
  // Doesn't proactively re-check the storage threshold here (that would mean
  // depending on FilesService, which already depends on FoldersService);
  // the next upload in this room will pick up the new total and alert if
  // it's now over a threshold, same as any other usage-growing operation.
  async copy(dataRoomId: string, folderId: string, dto: CopyFolderDto, actor: AuthenticatedUser): Promise<Folder> {
    await this.dataRoomAccess.assertContentManager(dataRoomId, actor);

    const source = await this.getFolderOrThrow(dataRoomId, folderId);
    const targetParent = dto.targetParentId ? await this.getFolderOrThrow(dataRoomId, dto.targetParentId) : null;

    const siblings = await this.prisma.folder.findMany({
      where: { dataRoomId, parentId: targetParent?.id ?? null, deletedAt: null },
      select: { name: true },
    });
    const nameTaken = siblings.some((sibling) => sibling.name === source.name);
    const newName = nameTaken ? `${source.name} (copy)` : source.name;

    let totalBytesCopied = 0n;
    const newRoot = await this.copyFolderRecursive(dataRoomId, source, targetParent, newName, actor, (bytes) => {
      totalBytesCopied += bytes;
    });

    if (totalBytesCopied > 0n) {
      await this.prisma.dataRoom.update({
        where: { id: dataRoomId },
        data: { storageUsedBytes: { increment: totalBytesCopied } },
      });
    }

    await this.auditLogService.record({
      action: 'FOLDER_COPIED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'Folder',
      resourceId: newRoot.id,
      metadata: { sourceFolderId: source.id, name: newRoot.name },
    });

    return newRoot;
  }

  private async copyFolderRecursive(
    dataRoomId: string,
    source: Folder,
    targetParent: Folder | null,
    name: string,
    actor: AuthenticatedUser,
    onBytesCopied: (bytes: bigint) => void,
  ): Promise<Folder> {
    const siblingCount = await this.prisma.folder.count({
      where: { dataRoomId, parentId: targetParent?.id ?? null, deletedAt: null },
    });

    const newFolder = await this.prisma.folder.create({
      data: {
        dataRoomId,
        parentId: targetParent?.id ?? null,
        name,
        path: this.buildPath(targetParent, name),
        depth: targetParent ? targetParent.depth + 1 : 0,
        sortOrder: siblingCount,
        createdBy: actor.id,
      },
    });

    const files = await this.prisma.file.findMany({
      where: { dataRoomId, folderId: source.id, deletedAt: null },
      include: { currentVersion: true },
    });

    for (const file of files) {
      if (!file.currentVersion) continue;

      const buffer = await this.storage.read(file.currentVersion.storagePath);
      const saved = await this.storage.save(dataRoomId, file.name, buffer);

      await this.prisma.$transaction(async (tx) => {
        const draft = await tx.file.create({
          data: {
            dataRoomId,
            folderId: newFolder.id,
            name: file.name,
            description: file.description,
            mimeType: file.mimeType,
            extension: file.extension,
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
            mimeType: file.currentVersion!.mimeType,
            checksum: saved.checksum,
            uploadedBy: actor.id,
            comment: `Copied from "${file.name}"`,
          },
        });

        return tx.file.update({ where: { id: draft.id }, data: { currentVersionId: version.id } });
      });

      onBytesCopied(BigInt(saved.sizeBytes));
    }

    const childFolders = await this.prisma.folder.findMany({
      where: { dataRoomId, parentId: source.id, deletedAt: null },
    });

    for (const child of childFolders) {
      await this.copyFolderRecursive(dataRoomId, child, newFolder, child.name, actor, onBytesCopied);
    }

    return newFolder;
  }

  // Called by DataRoomsService right after creating a CIRP data room.
  async seedCirpTemplate(dataRoomId: string, createdBy: string): Promise<void> {
    await this.prisma.folder.createMany({
      data: CIRP_DEFAULT_FOLDERS.map((name, index) => ({
        dataRoomId,
        parentId: null,
        name,
        path: `/${name}`,
        depth: 0,
        sortOrder: index,
        createdBy,
      })),
    });
  }

  // Resolves a relative folder path (e.g. from a browser folder-upload's
  // webkitRelativePath, ["Subfolder", "Nested"]) into a Folder id, creating
  // any segments that don't exist yet under the given parent. Used by the
  // Files module so dragging a whole OS folder in recreates its structure.
  async findOrCreateFolderPath(
    dataRoomId: string,
    parentId: string | null,
    segments: string[],
    createdBy: string,
  ): Promise<string | null> {
    let currentParentId = parentId;
    let currentParent = parentId ? await this.getFolderOrThrow(dataRoomId, parentId) : null;

    for (const name of segments) {
      const existing = await this.prisma.folder.findFirst({
        where: { dataRoomId, parentId: currentParentId, name, deletedAt: null },
      });

      if (existing) {
        currentParent = existing;
        currentParentId = existing.id;
        continue;
      }

      const siblingCount = await this.prisma.folder.count({
        where: { dataRoomId, parentId: currentParentId, deletedAt: null },
      });

      const created = await this.prisma.folder.create({
        data: {
          dataRoomId,
          parentId: currentParentId,
          name,
          path: this.buildPath(currentParent, name),
          depth: currentParent ? currentParent.depth + 1 : 0,
          sortOrder: siblingCount,
          createdBy,
        },
      });

      currentParent = created;
      currentParentId = created.id;
    }

    return currentParentId;
  }

  private async getFolderOrThrow(dataRoomId: string, folderId: string): Promise<Folder> {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, dataRoomId, deletedAt: null },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  private buildPath(parent: Folder | null, name: string): string {
    return parent ? `${parent.path}/${name}` : `/${name}`;
  }

  private async isDescendant(dataRoomId: string, ancestorId: string, candidateId: string): Promise<boolean> {
    let current: { id: string; parentId: string | null } | null = await this.prisma.folder.findFirst({
      where: { id: candidateId, dataRoomId },
      select: { id: true, parentId: true },
    });

    while (current) {
      if (current.id === ancestorId) {
        return true;
      }
      if (!current.parentId) {
        return false;
      }
      current = await this.prisma.folder.findFirst({
        where: { id: current.parentId, dataRoomId },
        select: { id: true, parentId: true },
      });
    }

    return false;
  }

  private async rebuildDescendantPaths(folder: Folder): Promise<void> {
    const children = await this.prisma.folder.findMany({
      where: { parentId: folder.id, deletedAt: null },
    });

    for (const child of children) {
      const updatedChild = await this.prisma.folder.update({
        where: { id: child.id },
        data: { path: `${folder.path}/${child.name}`, depth: folder.depth + 1 },
      });
      await this.rebuildDescendantPaths(updatedChild);
    }
  }
}
