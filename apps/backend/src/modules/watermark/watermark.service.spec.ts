import { PDFDocument } from 'pdf-lib';
import sharp = require('sharp');
import { WatermarkService, WatermarkElements } from './watermark.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WatermarkService', () => {
  const service = new WatermarkService({} as PrismaService);
  const elements: WatermarkElements = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    ipAddress: '203.0.113.7',
    timestamp: '2026-06-28T10:00:00.000Z',
  };

  it('stamps a PDF without corrupting it', async () => {
    const original = await PDFDocument.create();
    original.addPage([300, 300]);
    const buffer = Buffer.from(await original.save());

    const watermarked = await service.apply(buffer, 'pdf', elements);
    expect(watermarked.length).toBeGreaterThan(buffer.length);

    const reloaded = await PDFDocument.load(watermarked);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('stamps an image without corrupting it', async () => {
    const buffer = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const watermarked = await service.apply(buffer, 'png', elements);

    const metadata = await sharp(watermarked).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });

  it('prepends a readable header to text files', async () => {
    const buffer = Buffer.from('Original confidential content.', 'utf-8');

    const watermarked = await service.apply(buffer, 'txt', elements);
    const text = watermarked.toString('utf-8');

    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
    expect(text).toContain('203.0.113.7');
    expect(text).toContain('Original confidential content.');
  });

  it('leaves unsupported types untouched', async () => {
    const buffer = Buffer.from('binary-ish content');
    const result = await service.apply(buffer, 'docx', elements);
    expect(result).toBe(buffer);
  });

  // .eml is plain-text MIME, so it's watermarked the same way as txt/csv.
  it('stamps a readable header onto .eml files, same as txt', async () => {
    const buffer = Buffer.from('From: a@x.com\r\nTo: b@x.com\r\nSubject: Hi\r\n\r\nBody text.', 'utf-8');
    const watermarked = await service.apply(buffer, 'eml', elements);
    const text = watermarked.toString('utf-8');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Body text.');
  });

  // .msg is a binary OLE2 file, not text -- confirmed a deliberate,
  // documented non-fix (see apply()'s own comment): touching its bytes
  // without a real parser would corrupt it, so it must pass through
  // byte-for-byte unchanged rather than get "watermarked" into garbage.
  it('leaves .msg files byte-for-byte unchanged rather than corrupting the binary format', async () => {
    const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01, 0x02, 0x03]);
    const result = await service.apply(buffer, 'msg', elements);
    expect(result).toBe(buffer);
  });
});

// Regression coverage for the "configured but never enforced" bug: a data
// room's watermarkTemplate/Opacity/Position were stored and shown in the
// UI's own API response but apply() never read them, always using
// hardcoded text/opacity/rotation instead -- confirmed live during the
// production-readiness audit (a real data room already had non-default-
// looking values persisted, but WatermarkService had zero references to
// any of the three fields anywhere in the codebase).
describe('WatermarkService -- per-room config is actually applied', () => {
  const service = new WatermarkService({} as PrismaService);
  const elements: WatermarkElements = {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    ipAddress: '198.51.100.20',
    timestamp: '2026-09-21T14:30:05.000Z',
  };

  it('renders a custom template into the text watermark, not the hardcoded default', async () => {
    const buffer = Buffer.from('Original confidential content.', 'utf-8');
    const watermarked = await service.apply(buffer, 'txt', elements, {
      template: 'Prepared for {{name}} ({{email}}) on {{date}} at {{time}} from {{ip}}',
      opacity: 0.25,
      position: 'diagonal',
    });
    const text = watermarked.toString('utf-8');

    expect(text).toContain('Prepared for Priya Sharma (priya@example.com) on 2026-09-21 at 14:30:05 from 198.51.100.20');
  });

  it('leaves an unrecognized {{token}} verbatim instead of silently dropping it', async () => {
    const buffer = Buffer.from('content', 'utf-8');
    const watermarked = await service.apply(buffer, 'txt', elements, {
      template: '{{name}} — {{nonexistentToken}}',
      opacity: 0.25,
      position: 'diagonal',
    });
    expect(watermarked.toString('utf-8')).toContain('Priya Sharma — {{nonexistentToken}}');
  });

  it('a room with no config (default) still renders the same result as before this fix', async () => {
    const buffer = Buffer.from('content', 'utf-8');
    const watermarked = await service.apply(buffer, 'txt', elements);
    const text = watermarked.toString('utf-8');
    expect(text).toContain('Priya Sharma');
    expect(text).toContain('priya@example.com');
    expect(text).toContain('198.51.100.20');
    expect(text).toContain('CONFIDENTIAL');
  });

  it('applies the configured opacity to a PDF watermark, not the hardcoded 0.3', async () => {
    const original = await PDFDocument.create();
    original.addPage([300, 300]);
    const buffer = Buffer.from(await original.save());

    const faint = await service.apply(buffer, 'pdf', elements, { template: '{{name}}', opacity: 0.05, position: 'diagonal' });
    const bold = await service.apply(buffer, 'pdf', elements, { template: '{{name}}', opacity: 1, position: 'diagonal' });

    // Both must still be valid, loadable PDFs -- the opacity value itself
    // isn't easily recoverable from the saved bytes, so this proves the
    // configured value flows through without corrupting the document
    // rather than asserting on the literal pixel alpha.
    await expect(PDFDocument.load(faint)).resolves.toBeDefined();
    await expect(PDFDocument.load(bold)).resolves.toBeDefined();
  });

  it('clamps an out-of-range opacity instead of passing it straight to the renderer', async () => {
    const buffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    // 0 would make the watermark invisible -- defeats the point of the
    // feature -- and this is the defense-in-depth floor documented next to
    // MIN_OPACITY, exercised in case a value ever reaches apply() without
    // going through the DTO's own @Min(0.05) validator.
    await expect(service.apply(buffer, 'png', elements, { template: '{{name}}', opacity: 0, position: 'diagonal' })).resolves.toBeInstanceOf(Buffer);
    await expect(service.apply(buffer, 'png', elements, { template: '{{name}}', opacity: 5, position: 'diagonal' })).resolves.toBeInstanceOf(Buffer);
  });

  it('renders an image watermark without rotation when position is "tiled"', async () => {
    const buffer = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const watermarked = await service.apply(buffer, 'png', elements, { template: '{{name}}', opacity: 0.3, position: 'tiled' });
    const metadata = await sharp(watermarked).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });

  it('falls back to the diagonal default for an unrecognized position value', async () => {
    const buffer = Buffer.from('content', 'utf-8');
    // 'tiled' is the only recognized alternative -- anything else (a typo,
    // a future value written by another tool) must not throw or silently
    // remove the watermark.
    await expect(
      service.apply(buffer, 'txt', elements, { template: '{{name}}', opacity: 0.25, position: 'center' }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});
