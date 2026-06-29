import { renderEmailHtml, renderEmailText } from './layout';

export interface EmailVerificationParams {
  recipientName: string;
  verifyUrl: string;
}

// Dormant: no trigger calls this today. There's no self-service signup and
// no verification step distinct from accepting an invite in this app --
// built so the template/branding exists if that ever changes.
export function emailVerificationTemplate(params: EmailVerificationParams): { subject: string; html: string; text: string } {
  const { recipientName, verifyUrl } = params;
  const subject = 'Verify your email for Varied Reach';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">Please confirm this is your email address to finish setting up your account.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nPlease confirm this is your email address to finish setting up your account.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: 'Verify your email for Varied Reach', bodyHtml, ctaLabel: 'Verify Email', ctaUrl: verifyUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Verify your email', ctaUrl: verifyUrl }),
  };
}
