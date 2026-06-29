import { renderEmailHtml, renderEmailText } from './layout';

export interface SubscriptionActivatedParams {
  recipientName: string;
  planName: string;
}

// Dormant/future: no billing or subscription system exists in this app yet
// (confirmed -- zero scaffolding anywhere in the schema). Built so the
// template/branding exists ahead of that work.
export function subscriptionActivatedTemplate(params: SubscriptionActivatedParams): { subject: string; html: string; text: string } {
  const { recipientName, planName } = params;
  const subject = `Your Varied Reach ${planName} subscription is active`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">Your <strong>${planName}</strong> subscription is now active.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nYour ${planName} subscription is now active.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml }),
    text: renderEmailText({ bodyText }),
  };
}
