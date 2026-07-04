import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
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

  async saveFromPath(dataRoomId: string, originalName: string, tempPath: string): Promise<SavedFile> {
    const safeName = `${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const relativePath = join(dataRoomId, safeName);
    const absolutePath = join(this.rootPath, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });

    // Checksum first, while the file is still at tempPath -- rename only
    // after we've successfully read it, so a hashing failure doesn't leave
    // the file moved with no checksum.
    const checksum = await this.streamingChecksum(tempPath);
    await rename(tempPath, absolutePath);
    const { size } = await stat(absolutePath);

    return { storagePath: relativePath, sizeBytes: size, checksum };
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(join(this.rootPath, storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    await rm(join(this.rootPath, storagePath), { force: true });
  }

  private async streamingChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    await pipeline(createReadStream(filePath), hash);
    return hash.digest('hex');
  }
}
