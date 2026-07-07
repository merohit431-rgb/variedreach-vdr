import { renderEmailHtml, renderEmailText } from './layout';

export interface LoginAlertParams {
  firstName: string;
  device: string;
  ipAddress: string;
  whenLabel: string;
  securityUrl: string;
}

export function loginAlertTemplate(params: LoginAlertParams): { subject: string; html: string; text: string } {
  const { firstName, device, ipAddress, whenLabel, securityUrl } = params;
  const subject = 'New sign-in to your Varied Reach account';

  const rows: Array<[string, string]> = [
    ['Device', device],
    ['IP address', ipAddress],
    ['Time', whenLabel],
  ];
  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 6px 16px 6px 0; font-size: 13px; color: #64748b; white-space: nowrap; vertical-align: top;">${label}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${value}</td>
        </tr>`,
    )
    .join('');

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${firstName}, we noticed a new sign-in to your account:</p>
    <table style="border-collapse: collapse; width: 100%; margin: 0 0 20px 0;">${rowsHtml}</table>
    <p style="margin: 0;">If this was you, no action is needed. If you don't recognize this, secure your account immediately and change your password.</p>
  `;
  const bodyText = `Hi ${firstName}, we noticed a new sign-in to your account:\n\n${rows.map(([l, v]) => `${l}: ${v}`).join('\n')}\n\nIf this was you, no action is needed. If you don't recognize this, secure your account immediately and change your password.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml, ctaLabel: 'Review account security', ctaUrl: securityUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Review your account security', ctaUrl: securityUrl }),
  };
}
