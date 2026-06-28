import type { Response } from 'express';

export function sendFileResponse(
  res: Response,
  content: { buffer: Buffer; filename: string; mimeType: string },
  disposition: 'inline' | 'attachment' = 'attachment',
): void {
  const asciiFallback = content.filename.replace(/[^\x20-\x7E]/g, '_');
  res.set({
    'Content-Type': content.mimeType,
    'Content-Disposition': `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(content.filename)}`,
    'Content-Length': content.buffer.length,
  });
  res.send(content.buffer);
}
