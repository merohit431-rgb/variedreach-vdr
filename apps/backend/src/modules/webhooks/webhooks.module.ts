import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ResendWebhookService } from './resend-webhook.service';

@Module({
  controllers: [WebhooksController],
  providers: [ResendWebhookService],
})
export class WebhooksModule {}
