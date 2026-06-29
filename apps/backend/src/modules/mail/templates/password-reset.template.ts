import { renderEmailHtml, renderEmailText } from './layout';

export interface PasswordResetParams {
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetTemplate(params: PasswordResetParams): { subject: string; html: string; text: string } {
  const { resetUrl, expiresInMinutes } = params;
  const subject = 'Reset your Varied Reach password';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">We received a request to reset your password.</p>
    <p style="margin: 0 0 16px 0;">This link expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
  `;
  const bodyText = `We received a request to reset your password.\n\nThis link expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: 'Reset your Varied Reach password', bodyHtml, ctaLabel: 'Reset Password', ctaUrl: resetUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Reset your password', ctaUrl: resetUrl }),
  };
}
