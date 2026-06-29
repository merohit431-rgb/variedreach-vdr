import { renderEmailHtml, renderEmailText } from './layout';

export interface DataRoomInvitationParams {
  recipientName: string;
  dataRoomName: string;
  inviterName: string;
  loginUrl: string;
}

// Distinct from UserInvitation: this fires when an already-active user is
// added to an additional data room. They already have a password, so this
// links straight to login rather than asking them to set one up again.
export function dataRoomInvitationTemplate(params: DataRoomInvitationParams): { subject: string; html: string; text: string } {
  const { recipientName, dataRoomName, inviterName, loginUrl } = params;
  const subject = `You've been added to "${dataRoomName}" on Varied Reach`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 16px 0;"><strong>${inviterName}</strong> has added you to the <strong>${dataRoomName}</strong> data room on Varied Reach.</p>
    <p style="margin: 0 0 16px 0;">Log in to your existing account to view it.</p>
  `;
  const bodyText = `Hi ${recipientName},\n\n${inviterName} has added you to the "${dataRoomName}" data room on Varied Reach.\n\nLog in to your existing account to view it.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: `${inviterName} added you to a new data room on Varied Reach`, bodyHtml, ctaLabel: 'Go to Varied Reach', ctaUrl: loginUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Go to Varied Reach', ctaUrl: loginUrl }),
  };
}
