import { Global, Module } from '@nestjs/common';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { STORAGE_SERVICE } from './storage.interface';

@Global()
@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: LocalStorageProvider }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
