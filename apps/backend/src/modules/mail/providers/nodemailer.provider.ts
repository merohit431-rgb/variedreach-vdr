import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { IMailProvider, MailMessage, MailSendResult } from '../mail-provider.interface';

// Dev only -- points at the local MailHog container. See ResendMailProvider
// for staging/prod.
@Injectable()
export class NodemailerMailProvider implements IMailProvider {
  private readonly logger = new Logger(NodemailerMailProvider.name);
  private readonly transporter: Transporter;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.transporter = createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<boolean>('mail.secure'),
      auth: this.configService.get<string>('mail.user')
        ? {
            user: this.configService.get<string>('mail.user'),
            pass: this.configService.get<string>('mail.password'),
          }
        : undefined,
    });
    this.fromName = this.configService.get<string>('mail.fromName')!;
    this.fromAddress = this.configService.get<string>('mail.fromAddress')!;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send mail to ${message.to}: ${(error as Error).message}`);
      return { success: false, errorMessage: (error as Error).message };
    }
  }
}
