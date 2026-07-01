// Shared shell every template renders through. There's no logo image file
// anywhere in this repo (apps/frontend/public/ is empty but for .gitkeep,
// and Logo.tsx's own comment calls it a placeholder) and email clients
// can't reliably render the in-app CSS-gradient+icon-font mark anyway, so
// the header reproduces the same look as plain text + inline CSS instead.
// Table-based, inline-CSS-only layout (no <style> blocks -- many clients
// strip <head>) for broad email-client compatibility, max-width 600px,
// single column, mobile-responsive by virtue of being narrow and fluid.

const BRAND_700 = '#083E84';
const BRAND_600 = '#0A4DA3';
const SLATE_900 = '#0F172A';
const SLATE_500 = '#64748B';
const SLATE_400 = '#94A3B8';
const SLATE_200 = '#E2E8F0';
const SLATE_50 = '#F8FAFC';

export interface EmailLayoutOptions {
  previewText: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function renderEmailHtml(options: EmailLayoutOptions): string {
  const { previewText, bodyHtml, ctaLabel, ctaUrl } = options;

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
      <tr>
        <td style="padding: 8px 40px 32px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-radius: 6px; background-color: ${BRAND_600};">
                <a href="${ctaUrl}" target="_blank"
                   style="display: inline-block; padding: 12px 28px; font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 6px;">
                  ${ctaLabel}
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 16px 0 0 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: ${SLATE_500};">
            Or copy and paste this link into your browser:<br />
            <a href="${ctaUrl}" style="color: ${SLATE_500}; word-break: break-all;">${ctaUrl}</a>
          </p>
        </td>
      </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Varied Reach</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${SLATE_50};">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${SLATE_50};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid ${SLATE_200};">
              <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; font-size: 22px; letter-spacing: -0.3px; color: ${BRAND_700};">
                VARIED REACH
              </p>
              <p style="margin: 2px 0 0 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 500; color: ${SLATE_500};">
                Virtual Data Room
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 8px 40px; font-family: Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: ${SLATE_900};">
              ${bodyHtml}
            </td>
          </tr>
          ${ctaHtml}
          <tr>
            <td style="padding: 24px 40px 32px 40px; border-top: 1px solid ${SLATE_200};">
              <p style="margin: 0 0 10px 0; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: ${SLATE_500};">
                Varied Reach &ndash; Virtual Data Room
              </p>
              <p style="margin: 0 0 2px 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: ${SLATE_400};">
                📞 +91 88510 96461
              </p>
              <p style="margin: 0 0 2px 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: ${SLATE_400};">
                📧 <a href="mailto:support@variedreach.com" style="color: ${SLATE_400}; text-decoration: none;">support@variedreach.com</a>
              </p>
              <p style="margin: 0 0 16px 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: ${SLATE_400};">
                🌐 <a href="https://vdr.variedreach.com" style="color: ${SLATE_400}; text-decoration: none;">vdr.variedreach.com</a>
              </p>
              <p style="margin: 0 0 4px 0; font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: ${SLATE_400};">
                This is an automated system notification from the Varied Reach Virtual Data Room.
              </p>
              <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: ${SLATE_400};">
                Please do not reply to this email. If you require assistance, please contact our support team using the details above.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailLayoutTextOptions {
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function renderEmailText(options: EmailLayoutTextOptions): string {
  const { bodyText, ctaLabel, ctaUrl } = options;
  const ctaText = ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : '';

  return `VARIED REACH — Virtual Data Room

${bodyText}${ctaText}

---
Varied Reach – Virtual Data Room
📞 +91 88510 96461
📧 support@variedreach.com
🌐 vdr.variedreach.com

This is an automated system notification from the Varied Reach Virtual Data Room.
Please do not reply to this email. If you require assistance, please contact our support team using the details above.`;
}
