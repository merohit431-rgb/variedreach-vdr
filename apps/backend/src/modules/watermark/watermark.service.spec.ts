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
});
