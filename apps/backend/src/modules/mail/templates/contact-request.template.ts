import { renderEmailHtml, renderEmailText } from './layout';

export type ContactRequestKind = 'DEMO' | 'CALLBACK';

export interface ContactRequestField {
  label: string;
  value: string;
}

export interface ContactRequestParams {
  kind: ContactRequestKind;
  requesterName: string;
  fields: ContactRequestField[];
}

const COPY: Record<ContactRequestKind, { subjectLead: string; headline: string }> = {
  DEMO: { subjectLead: 'New demo request', headline: 'requested a live demo from the marketing site' },
  CALLBACK: { subjectLead: 'New callback request', headline: 'requested a callback from the marketing site' },
};

// Field values are visitor-supplied free text going into an HTML email --
// escape them so a crafted submission can't inject markup into the
// notification.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Internal notification to the sales inbox -- both contact forms differ only
// in wording and submitted fields, so one parameterized template covers both
// (same approach as storage-warning.template.ts).
export function contactRequestTemplate(params: ContactRequestParams): { subject: string; html: string; text: string } {
  const { kind, requesterName, fields } = params;
  const copy = COPY[kind];
  const subject = `${copy.subjectLead}: ${requesterName}`;

  const rowsHtml = fields
    .map(
      (field) => `
        <tr>
          <td style="padding: 6px 16px 6px 0; font-size: 13px; color: #64748b; white-space: nowrap; vertical-align: top;">${escapeHtml(field.label)}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${escapeHtml(field.value)}</td>
        </tr>`,
    )
    .join('');

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;"><strong>${escapeHtml(requesterName)}</strong> ${copy.headline}.</p>
    <table style="border-collapse: collapse; width: 100%;">${rowsHtml}</table>
  `;
  const bodyText = `${requesterName} ${copy.headline}.\n\n${fields.map((field) => `${field.label}: ${field.value}`).join('\n')}`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml }),
    text: renderEmailText({ bodyText }),
  };
}
