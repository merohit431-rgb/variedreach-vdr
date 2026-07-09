import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ResendWebhookService } from './resend-webhook.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';

@SkipThrottle()
@ApiExcludeController()
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  constructor(
    private readonly resendWebhookService: ResendWebhookService,
    private readonly razorpayWebhookService: RazorpayWebhookService,
  ) {}

  // Signature-verified, not JWT-gated -- Resend calls this unauthenticated.
  // Real URL once deployed: https://<host>/api/v1/webhooks/resend
  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async handleResendWebhook(@Req() req: RawBodyRequest<Request>) {
    await this.resendWebhookService.handle(req.rawBody!, req.headers);
    return { received: true };
  }

  // Signature-verified, not JWT-gated -- Razorpay calls this unauthenticated.
  // Real URL once deployed: https://<host>/api/v1/webhooks/razorpay
  @Public()
  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(@Req() req: RawBodyRequest<Request>) {
    await this.razorpayWebhookService.handle(req.rawBody!, req.headers);
    return { received: true };
  }
}
