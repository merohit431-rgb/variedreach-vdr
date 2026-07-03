import { renderEmailHtml, renderEmailText } from './layout';

export interface SubscriptionActivatedParams {
  recipientName: string;
  planName: string;
  invoiceNumber?: string;
  amountLabel?: string; // e.g. "INR 24,995.00"
  storageGb?: number;
  billingCycle?: string;
  loginUrl?: string;
}

// Payment success + welcome, sent right after provisioning. Doubles as the
// receipt: the payment summary block gives the customer the invoice number
// and amount; the full PDF lives in their dashboard under Billing.
export function subscriptionActivatedTemplate(params: SubscriptionActivatedParams): { subject: string; html: string; text: string } {
  const { recipientName, planName, invoiceNumber, amountLabel, storageGb, billingCycle, loginUrl } = params;
  const subject = `Payment received — your Varied Reach ${planName} subscription is active`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding: 6px 0; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748B;">${label}</td>
      <td style="padding: 6px 0; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #0F172A; text-align: right; font-weight: 600;">${value}</td>
    </tr>`;

  const summary = invoiceNumber
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 20px 0; background-color: #F8FAFC; border-radius: 8px;">
      <tr><td style="padding: 16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${row('Invoice', invoiceNumber)}
          ${row('Plan', planName)}
          ${storageGb ? row('Storage', `${storageGb} GB`) : ''}
          ${billingCycle ? row('Billing', billingCycle) : ''}
          ${amountLabel ? row('Amount paid', amountLabel) : ''}
        </table>
      </td></tr>
    </table>`
    : '';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;">Thank you — your payment was received and your <strong>${planName}</strong> subscription is now active. Your organisation and admin account are ready.</p>
    ${summary}
    <p style="margin: 0 0 8px 0;">Your tax invoice is available anytime from <strong>Settings → Billing</strong> in your dashboard.</p>
  `;

  const bodyText = `Hi ${recipientName},

Thank you — your payment was received and your ${planName} subscription is now active.
${invoiceNumber ? `\nInvoice: ${invoiceNumber}` : ''}${amountLabel ? `\nAmount paid: ${amountLabel}` : ''}${storageGb ? `\nStorage: ${storageGb} GB` : ''}${billingCycle ? `\nBilling: ${billingCycle}` : ''}

Your tax invoice is available from Settings → Billing in your dashboard.`;

  return {
    subject,
    html: renderEmailHtml({
      previewText: subject,
      bodyHtml,
      ...(loginUrl ? { ctaLabel: 'Go to your dashboard', ctaUrl: loginUrl } : {}),
    }),
    text: renderEmailText({ bodyText, ...(loginUrl ? { ctaLabel: 'Go to your dashboard', ctaUrl: loginUrl } : {}) }),
  };
}
