import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [AuthModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, ProvisioningService],
})
export class RegistrationModule {}
