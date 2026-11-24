import { escapeHtml, renderEmailHtml, renderEmailText } from './layout';

export interface EmailVerificationParams {
  recipientName: string;
  verifyUrl: string;
}

// Phase 4 finding P4-23 (same class, found in this file specifically
// during the Phase 3C.3 closure, not just mail.service.ts): this previously
// claimed "dormant -- no trigger calls this today", which is wrong --
// registration.service.ts calls sendEmailVerificationEmail (which renders
// this template) on every self-serve signup.
export function emailVerificationTemplate(params: EmailVerificationParams): { subject: string; html: string; text: string } {
  const { recipientName, verifyUrl } = params;
  const subject = 'Verify your email for Varied Reach';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin: 0 0 16px 0;">Please confirm this is your email address to finish setting up your account.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nPlease confirm this is your email address to finish setting up your account.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: 'Verify your email for Varied Reach', bodyHtml, ctaLabel: 'Verify Email', ctaUrl: verifyUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Verify your email', ctaUrl: verifyUrl }),
  };
}
