export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Optional Reply-To. Used by the contact endpoints so the sales team can
  // reply straight to the requester instead of the noreply sender.
  replyTo?: string;
}

export interface MailSendResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

// Two implementations: NodemailerMailProvider (dev, talks to MailHog) and
// ResendMailProvider (staging/prod, talks to the real Resend API). Picked
// once at boot in mail.module.ts based on MAIL_PROVIDER — nothing else in
// the app branches on which one is active.
export interface IMailProvider {
  send(message: MailMessage): Promise<MailSendResult>;
}

export const MAIL_PROVIDER = 'MAIL_PROVIDER';
