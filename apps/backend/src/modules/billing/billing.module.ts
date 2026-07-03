import { Module } from '@nestjs/common';
import { BusinessProfileModule } from '../business-profile/business-profile.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  imports: [BusinessProfileModule],
  controllers: [BillingController],
  providers: [BillingService, InvoicePdfService],
  // Exported so the Super Admin controller can reuse the PDF generator.
  exports: [InvoicePdfService],
})
export class BillingModule {}
