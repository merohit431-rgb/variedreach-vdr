import { renderEmailHtml, renderEmailText } from './layout';

export interface UserInvitationParams {
  inviteUrl: string;
  dataRoomName: string;
  inviterName: string;
  expiresInHours: number;
}

export function userInvitationTemplate(params: UserInvitationParams): { subject: string; html: string; text: string } {
  const { inviteUrl, dataRoomName, inviterName, expiresInHours } = params;
  const subject = `You've been invited to "${dataRoomName}" on Varied Reach`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;"><strong>${inviterName}</strong> has invited you to the <strong>${dataRoomName}</strong> data room on Varied Reach.</p>
    <p style="margin: 0 0 16px 0;">Set your password to get started. This link expires in ${expiresInHours} hours.</p>
  `;
  const bodyText = `${inviterName} has invited you to the "${dataRoomName}" data room on Varied Reach.\n\nSet your password to get started. This link expires in ${expiresInHours} hours.`;

  return {
    subject,
    html: renderEmailHtml({ previewText: `${inviterName} invited you to a data room on Varied Reach`, bodyHtml, ctaLabel: 'Set Your Password', ctaUrl: inviteUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Set your password', ctaUrl: inviteUrl }),
  };
}
