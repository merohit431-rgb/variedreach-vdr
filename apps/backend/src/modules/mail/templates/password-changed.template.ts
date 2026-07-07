import { renderEmailHtml, renderEmailText } from './layout';

export interface PasswordChangedParams {
  firstName: string;
  whenLabel: string;
  securityUrl: string;
}

export function passwordChangedTemplate(params: PasswordChangedParams): { subject: string; html: string; text: string } {
  const { firstName, whenLabel, securityUrl } = params;
  const subject = 'Your Varied Reach password was changed';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${firstName}, your account password was changed on ${whenLabel}.</p>
    <p style="margin: 0;">If this was you, no action is needed. If you didn't make this change, secure your account immediately and contact your administrator.</p>
  `;
  const bodyText = `Hi ${firstName}, your account password was changed on ${whenLabel}.\n\nIf this was you, no action is needed. If you didn't make this change, secure your account immediately and contact your administrator.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml, ctaLabel: 'Review account security', ctaUrl: securityUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Review your account security', ctaUrl: securityUrl }),
  };
}
