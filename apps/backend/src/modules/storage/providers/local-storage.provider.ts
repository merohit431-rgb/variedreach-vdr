import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { IStorageService, SavedFile } from '../storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageService {
  private readonly rootPath: string;

  constructor(private readonly configService: ConfigService) {
    this.rootPath = this.configService.get<string>('app.storageLocalPath')!;
  }

  async save(dataRoomId: string, originalName: string, buffer: Buffer): Promise<SavedFile> {
    const safeName = `${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const relativePath = join(dataRoomId, safeName);
    const absolutePath = join(this.rootPath, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storagePath: relativePath,
      sizeBytes: buffer.length,
      checksum: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(join(this.rootPath, storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    await rm(join(this.rootPath, storagePath), { force: true });
  }
}
