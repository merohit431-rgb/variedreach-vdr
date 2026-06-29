import { renderEmailHtml, renderEmailText } from './layout';

export interface WelcomeEmailParams {
  recipientName: string;
  loginUrl: string;
}

// Fires once, right after acceptInvite() succeeds -- distinct from the
// invitation itself, which already happened.
export function welcomeEmailTemplate(params: WelcomeEmailParams): { subject: string; html: string; text: string } {
  const { recipientName, loginUrl } = params;
  const subject = 'Welcome to Varied Reach';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">Your account is set up and ready to go.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nYour account is set up and ready to go.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: 'Your Varied Reach account is ready', bodyHtml, ctaLabel: 'Log In', ctaUrl: loginUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Log in', ctaUrl: loginUrl }),
  };
}
