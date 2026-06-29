import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IMailProvider, MailMessage, MailSendResult } from '../mail-provider.interface';

// Staging/prod. resend.emails.send() never throws on a failed send -- it
// returns a discriminated union ({ data, error: null } | { data: null,
// error }) -- so success/failure must be read from the result, not from a
// catch block.
@Injectable()
export class ResendMailProvider implements IMailProvider {
  private readonly logger = new Logger(ResendMailProvider.name);
  private readonly resend: Resend;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('mail.resendApiKey'));
    this.fromName = this.configService.get<string>('mail.fromName')!;
    this.fromAddress = this.configService.get<string>('mail.fromAddress')!;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    const result = await this.resend.emails.send({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (result.error) {
      this.logger.error(`Failed to send mail to ${message.to}: ${result.error.message}`);
      return { success: false, errorMessage: result.error.message };
    }

    return { success: true, providerMessageId: result.data!.id };
  }
}
