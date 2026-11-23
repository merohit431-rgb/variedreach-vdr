import { OcrAdapter } from './ocr.adapter';
import * as ghostscript from './ghostscript.util';
import * as tesseract from './tesseract.util';
import type { ConfigService } from '@nestjs/config';
import type { ExtractedPageText } from '../pdf-extraction.adapter';

jest.mock('./ghostscript.util');
jest.mock('./tesseract.util');

const mockRasterizePage = ghostscript.rasterizePage as jest.Mock;
const mockRecognize = tesseract.recognize as jest.Mock;

const DEFAULT_CONFIG: Record<string, unknown> = {
  'ocr.enabled': true,
  'ocr.languages': 'eng+hin',
  'ocr.dpi': 150,
  'ocr.maxPagesPerDocument': 50,
  'ocr.timeoutMs': 20000,
};

function buildAdapter(configOverrides: Record<string, unknown> = {}) {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;
  return new OcrAdapter(configService);
}

function page(pageNumber: number, isScannedOrImageOnly: boolean): ExtractedPageText {
  return { pageNumber, text: isScannedOrImageOnly ? '' : 'real text', charCount: isScannedOrImageOnly ? 0 : 50, isScannedOrImageOnly };
}

const BUFFER = Buffer.from('%PDF-1.4\n%%EOF\n');

describe('OcrAdapter.recognizeScannedPages', () => {
  beforeEach(() => {
    mockRasterizePage.mockReset().mockResolvedValue(undefined);
    mockRecognize.mockReset().mockResolvedValue({ text: 'recognized text', confidence: 85 });
  });

  it('returns an empty map and never rasterizes anything when no pages are flagged as scanned', async () => {
    const adapter = buildAdapter();

    const results = await adapter.recognizeScannedPages(BUFFER, [page(1, false), page(2, false)]);

    expect(results.size).toBe(0);
    expect(mockRasterizePage).not.toHaveBeenCalled();
  });

  it('returns an empty map and never touches child_process when OCR is disabled', async () => {
    const adapter = buildAdapter({ 'ocr.enabled': false });

    const results = await adapter.recognizeScannedPages(BUFFER, [page(1, true)]);

    expect(results.size).toBe(0);
    expect(mockRasterizePage).not.toHaveBeenCalled();
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('OCRs only the flagged pages, leaving native-text pages untouched', async () => {
    const adapter = buildAdapter();

    const results = await adapter.recognizeScannedPages(BUFFER, [page(1, false), page(2, true), page(3, false), page(4, true)]);

    expect(mockRasterizePage).toHaveBeenCalledTimes(2);
    expect(results.has(2)).toBe(true);
    expect(results.has(4)).toBe(true);
    expect(results.has(1)).toBe(false);
    expect(results.has(3)).toBe(false);
  });

  it('records the recognized text and confidence for a successfully OCR’d page', async () => {
    mockRecognize.mockResolvedValue({ text: 'Resolution Professional report', confidence: 91 });
    const adapter = buildAdapter();

    const results = await adapter.recognizeScannedPages(BUFFER, [page(1, true)]);

    expect(results.get(1)).toMatchObject({ text: 'Resolution Professional report', confidence: 91, extractionMethod: 'OCR' });
  });

  it('processes flagged pages strictly sequentially, never in parallel', async () => {
    const order: string[] = [];
    mockRasterizePage.mockImplementation(async (_pdf: string, pageNumber: number) => {
      order.push(`rasterize-${pageNumber}-start`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`rasterize-${pageNumber}-end`);
    });
    const adapter = buildAdapter();

    await adapter.recognizeScannedPages(BUFFER, [page(1, true), page(2, true)]);

    expect(order).toEqual(['rasterize-1-start', 'rasterize-1-end', 'rasterize-2-start', 'rasterize-2-end']);
  });

  it('isolates a single page’s OCR failure -- that page becomes OCR_FAILED, other pages still succeed', async () => {
    mockRasterizePage.mockImplementation(async (_pdf: string, pageNumber: number) => {
      if (pageNumber === 2) throw new Error('ghostscript crashed');
    });
    const adapter = buildAdapter();

    const results = await adapter.recognizeScannedPages(BUFFER, [page(1, true), page(2, true), page(3, true)]);

    expect(results.get(2)).toMatchObject({ extractionMethod: 'OCR_FAILED', text: '', confidence: 0 });
    expect(results.get(1)?.extractionMethod).toBe('OCR');
    expect(results.get(3)?.extractionMethod).toBe('OCR');
  });

  it('caps processing at ocr.maxPagesPerDocument, leaving pages beyond the cap entirely absent from the result', async () => {
    const adapter = buildAdapter({ 'ocr.maxPagesPerDocument': 2 });

    const results = await adapter.recognizeScannedPages(BUFFER, [page(1, true), page(2, true), page(3, true)]);

    expect(mockRasterizePage).toHaveBeenCalledTimes(2);
    expect(results.has(1)).toBe(true);
    expect(results.has(2)).toBe(true);
    expect(results.has(3)).toBe(false); // left out entirely -- the processor treats this as UNAVAILABLE
  });

  it('passes the configured DPI and language settings through to Ghostscript and Tesseract', async () => {
    const adapter = buildAdapter({ 'ocr.dpi': 300, 'ocr.languages': 'eng' });

    await adapter.recognizeScannedPages(BUFFER, [page(1, true)]);

    expect(mockRasterizePage).toHaveBeenCalledWith(expect.any(String), 1, 300, expect.any(String), 20000);
    expect(mockRecognize).toHaveBeenCalledWith(expect.any(String), 'eng', 20000);
  });
});
