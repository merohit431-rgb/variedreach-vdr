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

// Per-data-room appearance, sourced from DataRoom.watermarkTemplate/
// watermarkOpacity/watermarkPosition (see that model's own comment for the
// supported {{token}} list). Optional on apply() so existing callers/tests
// keep working unchanged; the default below matches the schema's own
// column defaults, so "no config passed" behaves like a never-customized
// room rather than some third, undocumented appearance.
export interface WatermarkConfig {
  template: string;
  opacity: number;
  position: string;
}

const DEFAULT_TEMPLATE = '{{name}} | {{email}} | {{date}} | {{ip}} | CONFIDENTIAL';
const DEFAULT_OPACITY = 0.25;
const DEFAULT_POSITION = 'diagonal';
const DEFAULT_CONFIG: WatermarkConfig = { template: DEFAULT_TEMPLATE, opacity: DEFAULT_OPACITY, position: DEFAULT_POSITION };

// A floor, not just a ceiling: opacity 0 would make the watermark
// invisible, which for a feature that exists specifically for traceability
// is equivalent to silently disabling it. The DTO also enforces this same
// floor on write, so this is defense-in-depth against a value written by
// some other path (a seed script, an old row) rather than the primary gate.
const MIN_OPACITY = 0.05;

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

  async apply(
    buffer: Buffer,
    extension: string,
    elements: WatermarkElements,
    config: WatermarkConfig = DEFAULT_CONFIG,
  ): Promise<Buffer> {
    const normalized = extension.toLowerCase().replace(/^\./, '');
    const text = this.renderTemplate(config.template || DEFAULT_TEMPLATE, elements);
    const opacity = Number.isFinite(config.opacity) ? Math.min(Math.max(config.opacity, MIN_OPACITY), 1) : DEFAULT_OPACITY;
    // Only 'tiled' (a straight, unrotated grid) is a recognized alternative
    // today -- 'diagonal' and anything else (an unrecognized future value,
    // a bad direct-DB edit) fall back to the current default appearance
    // rather than rendering nothing or throwing.
    const diagonal = config.position !== 'tiled';

    if (normalized === 'pdf') {
      return this.applyToPdf(buffer, text, opacity, diagonal);
    }
    if (IMAGE_EXTENSIONS.includes(normalized)) {
      return this.applyToImage(buffer, text, opacity, diagonal);
    }
    if (normalized === 'txt' || normalized === 'csv') {
      return this.applyToText(buffer, text);
    }

    return buffer;
  }

  // {{name}} {{email}} {{date}} {{time}} {{ip}} -- kept in sync with the
  // token list documented on DataRoom.watermarkTemplate itself. An
  // unrecognized {{token}} is left verbatim rather than silently dropped,
  // so a typo in a customer's template is visible (and reportable) instead
  // of just vanishing from the rendered watermark.
  private renderTemplate(template: string, elements: WatermarkElements): string {
    const iso = elements.timestamp;
    const tokens: Record<string, string> = {
      name: elements.name,
      email: elements.email,
      ip: elements.ipAddress,
      date: iso.slice(0, 10),
      time: iso.slice(11, 19),
    };
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => tokens[key] ?? match);
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

  private async applyToPdf(buffer: Buffer, text: string, opacity: number, diagonal: boolean): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 9;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const stepX = textWidth + 100;
    const stepY = 130;
    const rotation = diagonal ? degrees(45) : degrees(0);

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
            opacity,
            rotate: rotation,
          });
        }
      }
    }

    return Buffer.from(await pdfDoc.save());
  }

  private async applyToImage(buffer: Buffer, text: string, opacity: number, diagonal: boolean): Promise<Buffer> {
    const image = sharp(buffer, { animated: false });
    const metadata = await image.metadata();
    const width = metadata.width ?? 1000;
    const height = metadata.height ?? 1000;
    const escaped = this.escapeXml(text);
    const rotation = diagonal ? -30 : 0;

    const stepX = 280;
    const stepY = 150;
    const tiles: string[] = [];

    for (let y = 40; y < height + stepY; y += stepY) {
      for (let x = 0; x < width + stepX; x += stepX) {
        tiles.push(
          `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})" font-size="14" font-family="Helvetica, Arial, sans-serif" fill="rgba(128,128,128,${opacity})">${escaped}</text>`,
        );
      }
    }

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tiles.join('')}</svg>`;

    return image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toBuffer();
  }

  private applyToText(buffer: Buffer, text: string): Buffer {
    const divider = '='.repeat(60);
    const header = [divider, 'CONFIDENTIAL — WATERMARKED COPY', text, divider, ''].join('\n');
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
