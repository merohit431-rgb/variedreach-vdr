import { renderEmailHtml, renderEmailText } from './layout';

export interface MfaStatusChangedParams {
  firstName: string;
  enabled: boolean;
  whenLabel: string;
  securityUrl: string;
}

export function mfaStatusChangedTemplate(params: MfaStatusChangedParams): { subject: string; html: string; text: string } {
  const { firstName, enabled, whenLabel, securityUrl } = params;
  const subject = enabled
    ? 'Two-factor authentication was enabled on your account'
    : 'Two-factor authentication was disabled on your account';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName}, email verification codes were ${enabled ? 'enabled' : 'disabled'} for your account on ${whenLabel}.
    </p>
    <p style="margin: 0;">If this was you, no action is needed. If you didn't make this change, secure your account immediately and contact your administrator.</p>
  `;
  const bodyText = `Hi ${firstName}, email verification codes were ${enabled ? 'enabled' : 'disabled'} for your account on ${whenLabel}.\n\nIf this was you, no action is needed. If you didn't make this change, secure your account immediately and contact your administrator.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml, ctaLabel: 'Review account security', ctaUrl: securityUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Review your account security', ctaUrl: securityUrl }),
  };
}
