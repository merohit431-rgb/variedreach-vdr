import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ResendWebhookService } from './resend-webhook.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import { RegistrationModule } from '../registration/registration.module';

@Module({
  imports: [RegistrationModule],
  controllers: [WebhooksController],
  providers: [ResendWebhookService, RazorpayWebhookService],
})
export class WebhooksModule {}
