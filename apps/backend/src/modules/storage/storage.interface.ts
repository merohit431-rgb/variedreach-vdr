export interface SavedFile {
  storagePath: string;
  sizeBytes: number;
  checksum: string;
}

// Local filesystem for V1.0. Swapping to S3/R2 means implementing this
// interface again and changing one provider registration in storage.module —
// nothing in the Files module needs to change.
export interface IStorageService {
  save(dataRoomId: string, originalName: string, buffer: Buffer): Promise<SavedFile>;
  // Moves an already-on-disk upload (multer's diskStorage temp file) into
  // permanent storage without holding it in memory -- the only safe way to
  // handle uploads up to ~2GB inside a memory-capped container.
  saveFromPath(dataRoomId: string, originalName: string, tempPath: string): Promise<SavedFile>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
