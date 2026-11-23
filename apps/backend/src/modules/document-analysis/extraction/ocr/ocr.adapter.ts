import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rasterizePage } from './ghostscript.util';
import { recognize } from './tesseract.util';
import { ExtractedPageText } from '../pdf-extraction.adapter';

export interface OcrPageResult {
  text: string;
  confidence: number;
  extractionMethod: 'OCR' | 'OCR_FAILED';
  durationMs: number;
}

// Runs local OCR (Ghostscript rasterize -> Tesseract recognize, both apk
// packages, zero Python) for pages PdfExtractionAdapter already flagged
// isScannedOrImageOnly -- the only signal this feature has ever had for
// "needs OCR," unchanged from Phase 3B. Sequential, never parallel, within
// one document: a second memory-hungry step in the same container already
// running pdfjs-dist at Worker concurrency:2 (see queue.config.ts's own
// comment on that limit). Never touches the original stored file -- only a
// throwaway temp copy is ever read, so verifyChecksum()'s SHA-256 check
// (against the buffer from storage.read()) is unaffected by construction.
@Injectable()
export class OcrAdapter {
  private readonly logger = new Logger(OcrAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async recognizeScannedPages(buffer: Buffer, pages: ExtractedPageText[]): Promise<Map<number, OcrPageResult>> {
    const results = new Map<number, OcrPageResult>();
    if (!this.configService.get<boolean>('ocr.enabled')) {
      return results;
    }

    const flaggedPages = pages.filter((p) => p.isScannedOrImageOnly);
    if (flaggedPages.length === 0) {
      return results;
    }

    const maxPages = this.configService.get<number>('ocr.maxPagesPerDocument')!;
    const pagesToProcess = flaggedPages.slice(0, maxPages);
    // Pages beyond the cap are left out of `results` entirely -- the
    // processor treats an absent entry as UNAVAILABLE, the same outcome as
    // today's pre-Phase-3C behavior for every scanned page.

    const dpi = this.configService.get<number>('ocr.dpi')!;
    const languages = this.configService.get<string>('ocr.languages')!;
    const timeoutMs = this.configService.get<number>('ocr.timeoutMs')!;

    const tempDir = os.tmpdir();
    const pdfPath = path.join(tempDir, `vdr-ocr-${randomUUID()}.pdf`);
    const tempFiles: string[] = [pdfPath];

    try {
      await fs.writeFile(pdfPath, buffer);

      for (const page of pagesToProcess) {
        const pngPath = path.join(tempDir, `vdr-ocr-${randomUUID()}-p${page.pageNumber}.png`);
        tempFiles.push(pngPath);
        const startedAt = Date.now();

        try {
          await rasterizePage(pdfPath, page.pageNumber, dpi, pngPath, timeoutMs);
          const recognized = await recognize(pngPath, languages, timeoutMs);
          results.set(page.pageNumber, {
            text: recognized.text,
            confidence: recognized.confidence,
            extractionMethod: 'OCR',
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          // A single page's OCR failure never fails the whole document --
          // the exact same isolation principle PdfExtractionAdapter already
          // applies to a single bad page's text-extraction failure.
          this.logger.warn(`OCR failed for page ${page.pageNumber}: ${(error as Error).message}`);
          results.set(page.pageNumber, { text: '', confidence: 0, extractionMethod: 'OCR_FAILED', durationMs: Date.now() - startedAt });
        }
      }
    } finally {
      await Promise.all(tempFiles.map((file) => fs.rm(file, { force: true }).catch(() => undefined)));
    }

    return results;
  }
}
