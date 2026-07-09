import { renderEmailHtml, renderEmailText } from './layout';

export interface PaymentFailedParams {
  recipientName: string;
  planName: string;
  reason?: string;
  retryUrl?: string;
}

// Sent when Razorpay reports payment.failed for a registration's order.
// The registration itself is untouched (provisionedAt stays null) so the
// customer can simply retry checkout with the same account.
export function paymentFailedTemplate(params: PaymentFailedParams): { subject: string; html: string; text: string } {
  const { recipientName, planName, reason, retryUrl } = params;
  const subject = `Your Varied Reach payment did not go through`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">We weren't able to process your payment for the <strong>${planName}</strong> plan${reason ? ` (${reason})` : ''}. No charge was made and your account has not been created.</p>
    <p style="margin: 0 0 8px 0;">You can pick up right where you left off — your plan selection is saved.</p>
  `;

  const bodyText = `Hi ${recipientName},

We weren't able to process your payment for the ${planName} plan${reason ? ` (${reason})` : ''}. No charge was made and your account has not been created.

You can pick up right where you left off — your plan selection is saved.`;

  return {
    subject,
    html: renderEmailHtml({
      previewText: subject,
      bodyHtml,
      ...(retryUrl ? { ctaLabel: 'Try again', ctaUrl: retryUrl } : {}),
    }),
    text: renderEmailText({ bodyText, ...(retryUrl ? { ctaLabel: 'Try again', ctaUrl: retryUrl } : {}) }),
  };
}
