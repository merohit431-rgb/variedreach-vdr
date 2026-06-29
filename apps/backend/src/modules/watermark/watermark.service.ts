import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
// `import sharp from 'sharp'` miscompiles to `sharp_1.default(...)` under this
// tsconfig (no esModuleInterop) and throws "is not a function" at runtime —
// use the CJS-correct form instead.
import sharp = require('sharp');
import { PrismaService } from '../../prisma/prisma.service';

export interface WatermarkElements {
  [key: string]: string;
  name: string;
  email: string;
  ipAddress: string;
  timestamp: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'webp'];

@Injectable()
export class WatermarkService {
  constructor(private readonly prisma: PrismaService) {}

  buildElements(actor: { firstName: string; lastName: string; email: string }, ipAddress: string): WatermarkElements {
    return {
      name: `${actor.firstName} ${actor.lastName}`,
      email: actor.email,
      ipAddress,
      timestamp: new Date().toISOString(),
    };
  }

  async apply(buffer: Buffer, extension: string, elements: WatermarkElements): Promise<Buffer> {
    const normalized = extension.toLowerCase().replace(/^\./, '');
    const lines = [
      `${elements.name} <${elements.email}>`,
      `IP ${elements.ipAddress} · ${elements.timestamp}`,
    ];

    if (normalized === 'pdf') {
      return this.applyToPdf(buffer, lines);
    }
    if (IMAGE_EXTENSIONS.includes(normalized)) {
      return this.applyToImage(buffer, lines);
    }
    if (normalized === 'txt' || normalized === 'csv') {
      return this.applyToText(buffer, lines);
    }

    return buffer;
  }

  async recordWatermark(input: {
    auditLogId: string;
    fileId: string;
    fileVersionId: string;
    userId: string | null;
    elements: WatermarkElements;
  }) {
    const watermarkId = `WM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;

    return this.prisma.watermark.create({
      data: {
        auditLogId: input.auditLogId,
        fileId: input.fileId,
        fileVersionId: input.fileVersionId,
        userId: input.userId,
        watermarkId,
        elements: input.elements,
      },
    });
  }

  private async applyToPdf(buffer: Buffer, lines: string[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const text = lines.join('   |   ');
    const fontSize = 9;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const stepX = textWidth + 100;
    const stepY = 130;

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();
      for (let y = -height * 0.5; y < height * 1.5; y += stepY) {
        for (let x = -width * 0.5; x < width * 1.5; x += stepX) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.55, 0.55, 0.55),
            opacity: 0.3,
            rotate: degrees(45),
          });
        }
      }
    }

    return Buffer.from(await pdfDoc.save());
  }

  private async applyToImage(buffer: Buffer, lines: string[]): Promise<Buffer> {
    const image = sharp(buffer, { animated: false });
    const metadata = await image.metadata();
    const width = metadata.width ?? 1000;
    const height = metadata.height ?? 1000;
    const text = this.escapeXml(lines.join('   |   '));

    const stepX = 280;
    const stepY = 150;
    const tiles: string[] = [];

    for (let y = 40; y < height + stepY; y += stepY) {
      for (let x = 0; x < width + stepX; x += stepX) {
        tiles.push(
          `<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-size="14" font-family="Helvetica, Arial, sans-serif" fill="rgba(128,128,128,0.45)">${text}</text>`,
        );
      }
    }

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tiles.join('')}</svg>`;

    return image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toBuffer();
  }

  private applyToText(buffer: Buffer, lines: string[]): Buffer {
    const divider = '='.repeat(60);
    const header = [divider, 'CONFIDENTIAL — WATERMARKED COPY', ...lines, divider, ''].join('\n');
    return Buffer.concat([Buffer.from(header, 'utf-8'), buffer]);
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
