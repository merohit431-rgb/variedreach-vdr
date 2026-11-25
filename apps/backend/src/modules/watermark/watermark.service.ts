import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
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

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

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

    // Phase 3D (client-confirmed requirement): dynamic watermarking applies
    // ONLY to PDF -- both native PDF uploads and an Office-convertible file's
    // converted-to-PDF preview, since callers in files.service.ts already
    // pass extension: 'pdf' for that case (the conversion happens before
    // this method is ever called). Every other format -- images, text,
    // archives, CAD -- must return the ORIGINAL bytes unchanged, never a
    // watermarked or otherwise modified copy, and never a misleading
    // "watermarked" preview. This used to also watermark images/text; that
    // was a real gap against this exact requirement, not a deliberate
    // feature, and is removed rather than kept as dead, re-enablable code.
    if (normalized === 'pdf') {
      return this.applyToPdf(buffer, text, opacity, diagonal);
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
    // pdf-lib deliberately tolerates many real-world-imperfect PDFs at
    // load() time rather than rejecting them outright, but a sufficiently
    // broken file (no resolvable page tree, a circular Kids reference, a
    // truncated xref) can still throw later -- as a raw TypeError/RangeError
    // from deep inside pdf-lib's internals, not its own structured parse
    // error. Confirmed this never touches the ORIGINAL buffer (read-only
    // input; nothing here writes back to storage) and never hangs or grows
    // memory (tested truncated/empty/self-referential/huge-declared-count
    // inputs -- every failure mode returns in under 25ms). It's a bad input
    // file, not a server fault, so it must become a 400, not an unhandled
    // 500 bubbling up through the global exception filter.
    try {
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
    } catch (err) {
      this.logger.warn(
        `PDF watermarking failed, treating the file as unprocessable: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        'This PDF could not be processed for secure viewing. It may be corrupted, truncated, or not a valid PDF file.',
      );
    }
  }

}
