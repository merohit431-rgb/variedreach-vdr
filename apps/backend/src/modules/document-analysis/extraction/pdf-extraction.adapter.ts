import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
  charCount: number;
  isScannedOrImageOnly: boolean;
}

export class PdfEncryptedError extends Error {
  constructor() {
    super('This PDF is password-protected and cannot be analysed without the password');
    this.name = 'PdfEncryptedError';
  }
}

export class PdfUnreadableError extends Error {
  constructor(reason: string) {
    super(`This PDF could not be read: ${reason}`);
    this.name = 'PdfUnreadableError';
  }
}

export class PdfTooLargeError extends Error {
  constructor(pageCount: number, maxPages: number) {
    super(`This document has ${pageCount} pages, which exceeds the ${maxPages}-page analysis limit`);
    this.name = 'PdfTooLargeError';
  }
}

// Page text below this length (after trimming whitespace) is treated as
// scanned/image-only -- a real text layer for a normal document page runs
// into the hundreds of characters at minimum; a handful of stray characters
// (a page number, a watermark caught by the renderer) is not "readable text"
// for summarisation purposes.
const SCANNED_PAGE_CHAR_THRESHOLD = 20;

// pdfjs-dist's bundled code (legacy/build/pdf.mjs and pdf.worker.mjs) calls
// Promise.withResolvers() internally -- a method that only shipped natively
// in V8/Node 22+. It is genuinely absent on this backend's pinned
// node:20-alpine production image (confirmed empirically against a real
// document on real staging: every analysis failed with "Promise.withResolvers
// is not a function", even though both Jest -- which mocks this library
// entirely -- and the standalone verify-pdf-extraction.js script -- run
// under whatever Node happens to be on the machine driving it, not the
// pinned production version -- stayed green). This is the standard,
// MDN-documented polyfill; the typeof guard makes it a no-op the moment the
// image is ever upgraded to a Node version that has it natively.
type PromiseWithResolvers = {
  withResolvers?: <T>() => { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };
};
const promiseCtor = Promise as unknown as PromiseWithResolvers;
if (typeof promiseCtor.withResolvers !== 'function') {
  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// pdfjs-dist is ESM-only; this backend's production entrypoint is plain
// `node dist/main.js` with no bundler, so the dynamic import is confined to
// this one adapter module rather than touched anywhere else. See the
// Phase 3B design doc's spike notes for why this is necessary and what was
// verified before relying on it.
@Injectable()
export class PdfExtractionAdapter {
  private readonly logger = new Logger(PdfExtractionAdapter.name);

  async extractPages(buffer: Buffer, maxPages: number): Promise<ExtractedPageText[]> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const standardFontDataUrl = `${path.join(pdfjsRoot, 'standard_fonts')}/`;
    const cMapUrl = `${path.join(pdfjsRoot, 'cmaps')}/`;

    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      standardFontDataUrl,
      cMapUrl,
      cMapPacked: true,
      useSystemFonts: false,
    });

    let doc;
    try {
      doc = await loadingTask.promise;
    } catch (error) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'PasswordException') {
        throw new PdfEncryptedError();
      }
      this.logger.warn(`PDF load failed: ${err.message ?? error}`);
      throw new PdfUnreadableError(err.message ?? 'malformed or unsupported PDF');
    }

    if (doc.numPages > maxPages) {
      throw new PdfTooLargeError(doc.numPages, maxPages);
    }

    const pages: ExtractedPageText[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      try {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        pages.push({
          pageNumber,
          text,
          charCount: text.length,
          isScannedOrImageOnly: text.length < SCANNED_PAGE_CHAR_THRESHOLD,
        });
      } catch (error) {
        // A single bad page never fails the whole document -- it's reported
        // as unreadable/scanned, consistent with "never fabricate content
        // from an unreadable page."
        this.logger.warn(`Page ${pageNumber} extraction failed: ${(error as Error).message}`);
        pages.push({ pageNumber, text: '', charCount: 0, isScannedOrImageOnly: true });
      }
    }

    return pages;
  }
}
