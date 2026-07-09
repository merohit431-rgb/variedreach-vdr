import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponModule } from '../coupon/coupon.module';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [AuthModule, CouponModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, ProvisioningService],
  exports: [ProvisioningService],
})
export class RegistrationModule {}
