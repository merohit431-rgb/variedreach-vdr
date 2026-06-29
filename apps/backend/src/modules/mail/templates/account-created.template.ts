import { renderEmailHtml, renderEmailText } from './layout';

export interface AccountCreatedParams {
  recipientName: string;
  loginUrl: string;
}

// Dormant: no trigger calls this today. Every account in this app is
// created via an invite (UserInvitation already covers that moment) -- no
// separate "account created" event exists. Built so the template/branding
// exists if a distinct account-creation path is added later.
export function accountCreatedTemplate(params: AccountCreatedParams): { subject: string; html: string; text: string } {
  const { recipientName, loginUrl } = params;
  const subject = 'Your Varied Reach account has been created';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">An account has been created for you on Varied Reach.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nAn account has been created for you on Varied Reach.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: 'Your Varied Reach account has been created', bodyHtml, ctaLabel: 'Go to Varied Reach', ctaUrl: loginUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Go to Varied Reach', ctaUrl: loginUrl }),
  };
}
