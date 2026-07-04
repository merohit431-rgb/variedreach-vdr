import { renderEmailHtml, renderEmailText } from './layout';

export interface DocumentUploadedParams {
  recipientName: string;
  dataRoomName: string;
  folderPath: string;
  documentName: string;
  uploadedBy: string;
  uploadedAt: string;
  dataRoomUrl: string;
}

export function documentUploadedTemplate(params: DocumentUploadedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { recipientName, dataRoomName, folderPath, documentName, uploadedBy, uploadedAt, dataRoomUrl } = params;
  const subject = `New Document Uploaded – ${dataRoomName}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${recipientName},</p>
    <p style="margin: 0 0 24px 0;">A new document has been uploaded to the data room you have access to.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 8px 12px; background-color: #F8FAFC; border-radius: 4px 4px 0 0; border: 1px solid #E2E8F0; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748B; font-weight: 500; width: 140px;">Data Room</td>
        <td style="padding: 8px 12px; background-color: #F8FAFC; border-radius: 4px 4px 0 0; border: 1px solid #E2E8F0; border-left: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #0F172A; font-weight: 600;">${dataRoomName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748B; font-weight: 500;">Folder</td>
        <td style="padding: 8px 12px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; border-left: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #0F172A;">${folderPath}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-top: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748B; font-weight: 500;">Document</td>
        <td style="padding: 8px 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-top: none; border-left: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #0F172A; font-weight: 600;">${documentName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748B; font-weight: 500;">Uploaded By</td>
        <td style="padding: 8px 12px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; border-left: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #0F172A;">${uploadedBy}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; background-color: #F8FAFC; border-radius: 0 0 4px 4px; border: 1px solid #E2E8F0; border-top: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748B; font-weight: 500;">Uploaded At</td>
        <td style="padding: 8px 12px; background-color: #F8FAFC; border-radius: 0 0 4px 4px; border: 1px solid #E2E8F0; border-top: none; border-left: none; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #0F172A;">${uploadedAt} IST</td>
      </tr>
    </table>
  `;

  const bodyText =
    `Hi ${recipientName},\n\nA new document has been uploaded to the data room you have access to.\n\n` +
    `Data Room:   ${dataRoomName}\n` +
    `Folder:      ${folderPath}\n` +
    `Document:    ${documentName}\n` +
    `Uploaded By: ${uploadedBy}\n` +
    `Uploaded At: ${uploadedAt} IST`;

  return {
    subject,
    html: renderEmailHtml({ previewText: subject, bodyHtml, ctaLabel: 'Open Data Room', ctaUrl: dataRoomUrl }),
    text: renderEmailText({ bodyText, ctaLabel: 'Open Data Room', ctaUrl: dataRoomUrl }),
  };
}
