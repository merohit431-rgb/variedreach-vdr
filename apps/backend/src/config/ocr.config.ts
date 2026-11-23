import { registerAs } from '@nestjs/config';

// Unlike claude.config.ts, OCR defaults to ON (opt-out, not opt-in) -- it's
// local and free, with no spend-approval gate of its own, unlike Claude.
// dpi defaults deliberately low (150, not the more common 300) given the
// backend container's own 1536M memory ceiling on staging is already shared
// with pdfjs-dist's parsing pressure -- a conservative starting point to
// revisit from real measurements, not a fixed requirement.
export default registerAs('ocr', () => ({
  enabled: process.env.OCR_ENABLED !== 'false',
  languages: process.env.OCR_LANGUAGES || 'eng+hin',
  dpi: parseInt(process.env.OCR_DPI || '150', 10),
  maxPagesPerDocument: parseInt(process.env.OCR_MAX_PAGES_PER_DOCUMENT || '50', 10),
  timeoutMs: parseInt(process.env.OCR_TIMEOUT_MS || '20000', 10),
  lowConfidenceThreshold: parseInt(process.env.OCR_LOW_CONFIDENCE_THRESHOLD || '70', 10),
}));
