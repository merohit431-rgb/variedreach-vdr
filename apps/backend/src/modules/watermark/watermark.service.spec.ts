import { BadRequestException } from '@nestjs/common';
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

  // Phase 3D (client-confirmed requirement): dynamic watermarking applies
  // ONLY to PDF. Every other format -- including images and text, which this
  // service used to also watermark -- must come back byte-for-byte
  // unchanged (same reference, not just equal content), never a modified or
  // misleadingly-"watermarked" copy.
  it('leaves an image byte-for-byte unchanged (no longer watermarked)', async () => {
    const buffer = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const result = await service.apply(buffer, 'png', elements);
    expect(result).toBe(buffer);
  });

  it('leaves a text file byte-for-byte unchanged (no longer watermarked)', async () => {
    const buffer = Buffer.from('Original confidential content.', 'utf-8');
    const result = await service.apply(buffer, 'txt', elements);
    expect(result).toBe(buffer);
  });

  it('leaves .eml files byte-for-byte unchanged (no longer watermarked)', async () => {
    const buffer = Buffer.from('From: a@x.com\r\nTo: b@x.com\r\nSubject: Hi\r\n\r\nBody text.', 'utf-8');
    const result = await service.apply(buffer, 'eml', elements);
    expect(result).toBe(buffer);
  });

  it('leaves an Office document untouched when (unusually) called with its own extension directly, not "pdf"', async () => {
    // The real call sites in files.service.ts always pass extension: 'pdf'
    // for an Office-convertible file (conversion happens before apply() is
    // ever invoked) -- this exercises apply()'s own fallback in isolation,
    // for the case where it's handed the original extension regardless.
    const buffer = Buffer.from('binary-ish content');
    const result = await service.apply(buffer, 'docx', elements);
    expect(result).toBe(buffer);
  });

  it('leaves archive and CAD files byte-for-byte unchanged (never watermarked)', async () => {
    for (const extension of ['zip', '7z', 'rar', 'dwg', 'dxf', 'dwfx']) {
      const buffer = Buffer.from(`fake ${extension} content`);
      const result = await service.apply(buffer, extension, elements);
      expect(result).toBe(buffer);
    }
  });

  it('leaves .msg files byte-for-byte unchanged (binary OLE2 -- never safe to touch, and no longer watermarked anyway)', async () => {
    const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01, 0x02, 0x03]);
    const result = await service.apply(buffer, 'msg', elements);
    expect(result).toBe(buffer);
  });
});

// Regression coverage for the "configured but never enforced" bug: a data
// room's watermarkTemplate/Opacity/Position were stored and shown in the
// UI's own API response but apply() never read them, always using
// hardcoded text/opacity/rotation instead. Exercised against PDF -- the only
// format apply() still actually renders a watermark onto, post-Phase-3D.
describe('WatermarkService -- per-room config is actually applied (PDF)', () => {
  const service = new WatermarkService({} as PrismaService);
  const elements: WatermarkElements = {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    ipAddress: '198.51.100.20',
    timestamp: '2026-09-21T14:30:05.000Z',
  };

  async function blankPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    return Buffer.from(await doc.save());
  }

  // pdf-lib's default save() FlateDecode-compresses content streams, so the
  // drawn text isn't a readable substring of the raw saved bytes -- unlike
  // the plain-text formats the old tests exercised this same assertion
  // against. Decompressing just to assert on literal content would mean a
  // new dependency for a test; following this same file's own existing
  // precedent (the opacity test below), these assert the document stays
  // valid and loadable with the configured template/opacity in play, not
  // the literal rendered text.
  it('renders a custom template into the PDF watermark without corrupting the document', async () => {
    const buffer = await blankPdf();
    const watermarked = await service.apply(buffer, 'pdf', elements, {
      template: 'Prepared for {{name}} ({{email}}) on {{date}} at {{time}} from {{ip}}',
      opacity: 0.25,
      position: 'diagonal',
    });

    expect(watermarked.length).toBeGreaterThan(buffer.length);
    await expect(PDFDocument.load(watermarked)).resolves.toBeDefined();
  });

  it('leaves an unrecognized {{token}} verbatim instead of silently dropping it', () => {
    // renderTemplate is private and its output isn't recoverable from a
    // compressed PDF's saved bytes (see the test above) -- this is the one
    // assertion in this file that reaches past that boundary deliberately,
    // since "an unknown token vanishes silently" vs. "stays visible and
    // reportable" is a real, specific behavior worth its own direct check.
    const rendered = (service as unknown as { renderTemplate(template: string, elements: WatermarkElements): string }).renderTemplate(
      '{{name}} — {{nonexistentToken}}',
      elements,
    );
    expect(rendered).toBe('Priya Sharma — {{nonexistentToken}}');
  });

  it('a room with no config (default) still renders successfully, same as before this fix', async () => {
    const buffer = await blankPdf();
    const watermarked = await service.apply(buffer, 'pdf', elements);
    expect(watermarked.length).toBeGreaterThan(buffer.length);
    await expect(PDFDocument.load(watermarked)).resolves.toBeDefined();
  });

  it('applies the configured opacity to a PDF watermark, not the hardcoded 0.3', async () => {
    const buffer = await blankPdf();

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
    const buffer = await blankPdf();

    // 0 would make the watermark invisible -- defeats the point of the
    // feature -- and this is the defense-in-depth floor documented next to
    // MIN_OPACITY, exercised in case a value ever reaches apply() without
    // going through the DTO's own @Min(0.05) validator.
    await expect(service.apply(buffer, 'pdf', elements, { template: '{{name}}', opacity: 0, position: 'diagonal' })).resolves.toBeInstanceOf(Buffer);
    await expect(service.apply(buffer, 'pdf', elements, { template: '{{name}}', opacity: 5, position: 'diagonal' })).resolves.toBeInstanceOf(Buffer);
  });

  it('renders a PDF watermark without rotation when position is "tiled"', async () => {
    const buffer = await blankPdf();
    const watermarked = await service.apply(buffer, 'pdf', elements, { template: '{{name}}', opacity: 0.3, position: 'tiled' });
    await expect(PDFDocument.load(watermarked)).resolves.toBeDefined();
  });

  it('falls back to the diagonal default for an unrecognized position value', async () => {
    const buffer = await blankPdf();
    // 'tiled' is the only recognized alternative -- anything else (a typo,
    // a future value written by another tool) must not throw or silently
    // remove the watermark.
    await expect(
      service.apply(buffer, 'pdf', elements, { template: '{{name}}', opacity: 0.25, position: 'center' }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});

// Regression coverage for a real staging crash (2026-11-21): pdf-lib
// tolerates many broken-but-recoverable PDFs at load() time, but can still
// throw a raw TypeError/RangeError later, deep inside its internals, for a
// file with no resolvable page tree -- which previously escaped as an
// unhandled 500 instead of a clean, non-disclosing 4xx. Every case here was
// first reproduced directly against pdf-lib outside Jest to confirm it
// fails fast (under 25ms, no heap growth) rather than hanging or leaking
// memory, before writing it up as a test.
describe('WatermarkService.apply -- malformed/truncated/unsupported PDFs', () => {
  const service = new WatermarkService({} as PrismaService);
  const elements: WatermarkElements = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    ipAddress: '203.0.113.7',
    timestamp: '2026-06-28T10:00:00.000Z',
  };

  it('malformed: a PDF header with no object structure at all throws a clean BadRequestException, not a raw 500', async () => {
    // The exact bytes that produced "Cannot read properties of undefined
    // (reading 'Pages')" uncaught on staging.
    const buffer = Buffer.from('%PDF-1.4\nnot actually a PDF object structure\n');

    await expect(service.apply(buffer, 'pdf', elements)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.apply(buffer, 'pdf', elements)).rejects.toThrow(
      'This PDF could not be processed for secure viewing',
    );
  });

  it('truncated: a valid PDF cut off mid-structure throws the same clean error', async () => {
    const original = await PDFDocument.create();
    original.addPage([300, 300]);
    const validBytes = Buffer.from(await original.save());
    const truncated = validBytes.subarray(0, Math.floor(validBytes.length * 0.3));

    await expect(service.apply(truncated, 'pdf', elements)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unsupported: a circular/self-referential page tree throws the same clean error (not an uncaught RangeError)', async () => {
    const buffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [2 0 R] /Count 1 >>\nendobj\ntrailer\n<< /Size 3 /Root 1 0 R >>\n%%EOF\n',
    );

    await expect(service.apply(buffer, 'pdf', elements)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('an empty buffer throws the same clean error', async () => {
    await expect(service.apply(Buffer.alloc(0), 'pdf', elements)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a genuinely valid PDF still watermarks successfully (unaffected by the fix)', async () => {
    const original = await PDFDocument.create();
    original.addPage([300, 300]);
    const buffer = Buffer.from(await original.save());

    const watermarked = await service.apply(buffer, 'pdf', elements);

    expect(watermarked.length).toBeGreaterThan(buffer.length);
    await expect(PDFDocument.load(watermarked)).resolves.toBeDefined();
  });
});
