import { Injectable, Logger } from '@nestjs/common';
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

  // Throws if the signature doesn't verify -- let it propagate to the
  // controller, which turns that into a 4xx via the global exception filter.
  // This (not JWT) is the actual security boundary for this route.
  async handle(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<void> {
    const event = this.resend.webhooks.verify({
      payload: rawBody.toString('utf8'),
      headers: {
        id: this.headerString(headers['webhook-id']),
        timestamp: this.headerString(headers['webhook-timestamp']),
        signature: this.headerString(headers['webhook-signature']),
      },
      webhookSecret: this.configService.get<string>('mail.resendWebhookSecret')!,
    });

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
