import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTemplate } from '@prisma/client';
import { EmailLogService } from '../email-log/email-log.service';
import { IMailProvider, MAIL_PROVIDER } from './mail-provider.interface';
import { userInvitationTemplate } from './templates/user-invitation.template';
import { dataRoomInvitationTemplate } from './templates/data-room-invitation.template';
import { passwordResetTemplate } from './templates/password-reset.template';
import { welcomeEmailTemplate } from './templates/welcome-email.template';
import { emailVerificationTemplate } from './templates/email-verification.template';
import { accountCreatedTemplate } from './templates/account-created.template';
import { storageWarningTemplate, StorageWarningLevel } from './templates/storage-warning.template';
import { subscriptionActivatedTemplate } from './templates/subscription-activated.template';
import { subscriptionRenewalReminderTemplate } from './templates/subscription-renewal-reminder.template';
import { documentUploadedTemplate } from './templates/document-uploaded.template';

export interface SendResult {
  sent: boolean;
}

interface DispatchContext {
  template: EmailTemplate;
  to: string;
  userId?: string;
  dataRoomId?: string;
  resentFromId?: string;
}

@Injectable()
export class MailService {
  private readonly subjectPrefix: string;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: IMailProvider,
    private readonly emailLogService: EmailLogService,
    private readonly configService: ConfigService,
  ) {
    this.subjectPrefix = this.configService.get<string>('mail.subjectPrefix') || '';
  }

  // The one place every send routes through: applies the subject prefix,
  // calls the registered provider, and records an EmailLog row regardless
  // of outcome -- this is what lets callers (inviteMember, resendInvite,
  // etc.) know whether a send actually succeeded instead of it being
  // silently swallowed, and is what makes every send show up in EmailLog
  // without each call site needing to remember to log it.
  private async dispatch(
    context: DispatchContext,
    rendered: { subject: string; html: string; text: string },
  ): Promise<SendResult> {
    const subject = `${this.subjectPrefix}${rendered.subject}`;
    const result = await this.provider.send({ to: context.to, subject, html: rendered.html, text: rendered.text });

    await this.emailLogService.record({
      template: context.template,
      status: result.success ? 'SENT' : 'FAILED',
      recipientEmail: context.to,
      subject,
      userId: context.userId,
      dataRoomId: context.dataRoomId,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
      resentFromId: context.resentFromId,
    });

    return { sent: result.success };
  }

  async sendUserInvitationEmail(
    to: string,
    inviteUrl: string,
    dataRoomName: string,
    inviterName: string,
    expiresInHours: number,
    context: { userId?: string; dataRoomId?: string; resentFromId?: string } = {},
  ): Promise<SendResult> {
    const rendered = userInvitationTemplate({ inviteUrl, dataRoomName, inviterName, expiresInHours });
    return this.dispatch({ template: 'USER_INVITATION', to, ...context }, rendered);
  }

  async sendDataRoomInvitationEmail(
    to: string,
    recipientName: string,
    loginUrl: string,
    dataRoomName: string,
    inviterName: string,
    context: { userId?: string; dataRoomId?: string } = {},
  ): Promise<SendResult> {
    const rendered = dataRoomInvitationTemplate({ recipientName, dataRoomName, inviterName, loginUrl });
    return this.dispatch({ template: 'DATA_ROOM_INVITATION', to, ...context }, rendered);
  }

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    expiresInMinutes: number,
    context: { userId?: string } = {},
  ): Promise<SendResult> {
    const rendered = passwordResetTemplate({ resetUrl, expiresInMinutes });
    return this.dispatch({ template: 'PASSWORD_RESET', to, ...context }, rendered);
  }

  async sendWelcomeEmail(
    to: string,
    recipientName: string,
    loginUrl: string,
    context: { userId?: string } = {},
  ): Promise<SendResult> {
    const rendered = welcomeEmailTemplate({ recipientName, loginUrl });
    return this.dispatch({ template: 'WELCOME_EMAIL', to, ...context }, rendered);
  }

  // Dormant -- no caller invokes this today. See email-verification.template.ts.
  async sendEmailVerificationEmail(
    to: string,
    recipientName: string,
    verifyUrl: string,
    context: { userId?: string } = {},
  ): Promise<SendResult> {
    const rendered = emailVerificationTemplate({ recipientName, verifyUrl });
    return this.dispatch({ template: 'EMAIL_VERIFICATION', to, ...context }, rendered);
  }

  // Dormant -- no caller invokes this today. See account-created.template.ts.
  async sendAccountCreatedEmail(
    to: string,
    recipientName: string,
    loginUrl: string,
    context: { userId?: string } = {},
  ): Promise<SendResult> {
    const rendered = accountCreatedTemplate({ recipientName, loginUrl });
    return this.dispatch({ template: 'ACCOUNT_CREATED', to, ...context }, rendered);
  }

  async sendStorageWarningEmail(
    to: string,
    level: StorageWarningLevel,
    dataRoomName: string,
    percentUsed: number,
    manageUrl: string,
    context: { userId?: string; dataRoomId?: string } = {},
  ): Promise<SendResult> {
    const rendered = storageWarningTemplate({ level, dataRoomName, percentUsed, manageUrl });
    const template: EmailTemplate =
      level === 'WARNING' ? 'STORAGE_WARNING_80' : level === 'CRITICAL' ? 'STORAGE_CRITICAL_95' : 'STORAGE_FULL_100';
    return this.dispatch({ template, to, ...context }, rendered);
  }

  // Dormant -- no caller invokes this today. See subscription-activated.template.ts.
  async sendSubscriptionActivatedEmail(
    to: string,
    recipientName: string,
    planName: string,
    context: { userId?: string } = {},
  ): Promise<SendResult> {
    const rendered = subscriptionActivatedTemplate({ recipientName, planName });
    return this.dispatch({ template: 'SUBSCRIPTION_ACTIVATED', to, ...context }, rendered);
  }

  // Dormant -- no caller invokes this today. See subscription-renewal-reminder.template.ts.
  async sendSubscriptionRenewalReminderEmail(
    to: string,
    recipientName: string,
    planName: string,
    renewalDate: string,
    context: { userId?: string } = {},
  ): Promise<SendResult> {
    const rendered = subscriptionRenewalReminderTemplate({ recipientName, planName, renewalDate });
    return this.dispatch({ template: 'SUBSCRIPTION_RENEWAL_REMINDER', to, ...context }, rendered);
  }

  async sendDocumentUploadedEmail(
    to: string,
    recipientName: string,
    dataRoomName: string,
    folderPath: string,
    documentName: string,
    uploadedBy: string,
    uploadedAt: string,
    dataRoomUrl: string,
    context: { userId?: string; dataRoomId?: string } = {},
  ): Promise<SendResult> {
    const rendered = documentUploadedTemplate({
      recipientName,
      dataRoomName,
      folderPath,
      documentName,
      uploadedBy,
      uploadedAt,
      dataRoomUrl,
    });
    return this.dispatch({ template: 'DOCUMENT_UPLOADED', to, ...context }, rendered);
  }
}
