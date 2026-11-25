import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { RegistrationModule } from '../registration/registration.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [BillingModule, RegistrationModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
