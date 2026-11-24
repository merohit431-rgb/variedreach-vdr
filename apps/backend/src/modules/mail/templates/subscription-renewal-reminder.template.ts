import { escapeHtml, renderEmailHtml, renderEmailText } from './layout';

export interface SubscriptionRenewalReminderParams {
  recipientName: string;
  planName: string;
  renewalDate: string;
}

// Phase 4 finding P4-23 (same class; this file's reasoning was stale, found
// during the Phase 3C.3 closure): a real billing/subscription system now
// exists (Subscription model, Razorpay payments, invoices) -- the "no
// billing system exists yet" premise below is outdated. This genuinely
// has zero callers today for a narrower, still-accurate reason: nothing
// yet triggers a renewal-reminder check (no scheduled job reads upcoming
// Subscription.currentPeriodEnd dates) -- the template/branding is ready
// for whenever that trigger is built, not for billing itself to exist.
export function subscriptionRenewalReminderTemplate(
  params: SubscriptionRenewalReminderParams,
): { subject: string; html: string; text: string } {
  const { recipientName, planName, renewalDate } = params;
  const subject = `Your Varied Reach ${planName} subscription renews soon`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin: 0 0 16px 0;">Your <strong>${escapeHtml(planName)}</strong> subscription renews on <strong>${escapeHtml(renewalDate)}</strong>.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\nYour ${planName} subscription renews on ${renewalDate}.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml }),
    text: renderEmailText({ bodyText }),
  };
}
