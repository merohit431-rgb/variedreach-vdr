import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailLogService } from '../email-log/email-log.service';

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailLogService: EmailLogService,
  ) {
    this.resend = new Resend(this.configService.get<string>('mail.resendApiKey'));
  }

  // This (not JWT) is the actual security boundary for this route. A
  // verification failure becomes a 400, not Nest's default 500 for an
  // uncaught throw -- a 4xx tells Resend the request itself was invalid
  // (don't retry); a 5xx would look like a transient server bug and could
  // trigger retries against a request that will never succeed.
  async handle(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<void> {
    let event;
    try {
      event = this.resend.webhooks.verify({
        payload: rawBody.toString('utf8'),
        headers: {
          id: this.headerString(headers['webhook-id']),
          timestamp: this.headerString(headers['webhook-timestamp']),
          signature: this.headerString(headers['webhook-signature']),
        },
        webhookSecret: this.configService.get<string>('mail.resendWebhookSecret')!,
      });
    } catch (error) {
      this.logger.warn(`Rejected Resend webhook with invalid signature: ${(error as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'email.delivered':
        await this.emailLogService.markDelivered(event.data.email_id);
        break;
      case 'email.bounced':
        await this.emailLogService.markBounced(event.data.email_id);
        break;
      default:
        // email.sent / email.opened / email.clicked / etc. -- EmailLog
        // already records SENT at send-time; only delivered/bounced need a
        // webhook update for V1, so everything else is a no-op.
        this.logger.debug(`Ignoring unhandled Resend webhook event: ${event.type}`);
    }
  }

  private headerString(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
  }
}
