import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
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

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send mail to ${to}: ${(error as Error).message}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.sendMail(
      to,
      'Reset your InsolvencyVDR password',
      `<p>We received a request to reset your password.</p>
       <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 60 minutes.</p>
       <p>If you didn't request this, you can safely ignore this email.</p>`,
    );
  }

  async sendInviteEmail(
    to: string,
    inviteUrl: string,
    dataRoomName: string,
    inviterName: string,
  ): Promise<void> {
    await this.sendMail(
      to,
      `You've been invited to "${dataRoomName}" on InsolvencyVDR`,
      `<p>${inviterName} has invited you to the "${dataRoomName}" data room on InsolvencyVDR.</p>
       <p><a href="${inviteUrl}">Click here to set your password and get started</a>. This link expires in 72 hours.</p>`,
    );
  }
}
