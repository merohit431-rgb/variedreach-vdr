import { renderEmailHtml, renderEmailText } from './layout';

export interface MfaOtpCodeParams {
  code: string;
  expiresInMinutes: number;
}

export function mfaOtpCodeTemplate(params: MfaOtpCodeParams): { subject: string; html: string; text: string } {
  const { code, expiresInMinutes } = params;
  const subject = `${code} is your verification code`;
  const spacedCode = code.split('').join(' ');

  const bodyHtml = `
    <p style="margin: 0 0 20px 0;">Use this code to finish signing in.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px 0;">
      <tr>
        <td style="padding: 16px 28px; background-color: #F1F5F9; border-radius: 10px; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #0F172A;">
          ${spacedCode}
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px 0;">This code expires in ${expiresInMinutes} minutes.</p>
    <p style="margin: 0;">If you didn't try to sign in, you can safely ignore this email — your account is still secure.</p>
  `;
  const bodyText = `Your verification code: ${code}\n\nThis code expires in ${expiresInMinutes} minutes.\n\nIf you didn't try to sign in, you can safely ignore this email — your account is still secure.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: `Your verification code is ${code}`, bodyHtml }),
    text: renderEmailText({ bodyText }),
  };
}
