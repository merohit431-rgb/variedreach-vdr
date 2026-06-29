import { renderEmailHtml, renderEmailText } from './layout';

export interface SubscriptionRenewalReminderParams {
  recipientName: string;
  planName: string;
  renewalDate: string;
}

// Dormant/future: no billing or subscription system exists in this app yet
// (confirmed -- zero scaffolding anywhere in the schema). Built so the
// template/branding exists ahead of that work.
export function subscriptionRenewalReminderTemplate(
  params: SubscriptionRenewalReminderParams,
): { subject: string; html: string; text: string } {
  const { recipientName, planName, renewalDate } = params;
  const subject = `Your Varied Reach ${planName} subscription renews soon`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">Your <strong>${planName}</strong> subscription renews on <strong>${renewalDate}</strong>.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nYour ${planName} subscription renews on ${renewalDate}.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml }),
    text: renderEmailText({ bodyText }),
  };
}
