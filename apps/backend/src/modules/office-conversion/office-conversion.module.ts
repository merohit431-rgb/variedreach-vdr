import { Global, Module } from '@nestjs/common';
import { OfficeConversionService } from './office-conversion.service';

@Global()
@Module({
  providers: [OfficeConversionService],
  exports: [OfficeConversionService],
})
export class OfficeConversionModule {}
