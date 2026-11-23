import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class TesseractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TesseractError';
  }
}

export interface TesseractResult {
  text: string;
  confidence: number;
}

// Tesseract's --tsv output is one row per level (page/block/paragraph/line/
// word), 12 tab-separated columns: level, page_num, block_num, par_num,
// line_num, word_num, left, top, width, height, conf, text. Only word-level
// rows (conf >= 0; higher levels report conf = -1, not a real score) carry
// both real text and a real confidence value -- this reconstructs the
// page's text by joining those words in order and averages their
// confidence into a single page-level score, the only confidence number
// anywhere in this feature that's independently measured rather than
// self-reported by a language model.
export function parseTsv(tsv: string): TesseractResult {
  const lines = tsv.trim().split('\n');
  const words: string[] = [];
  const confidences: number[] = [];

  for (const line of lines.slice(1)) {
    const columns = line.split('\t');
    if (columns.length < 12) continue;
    const conf = parseFloat(columns[10]);
    const text = columns[11];
    if (conf >= 0 && text && text.trim().length > 0) {
      words.push(text);
      confidences.push(conf);
    }
  }

  const confidence = confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
  return { text: words.join(' '), confidence };
}

// Runs the Tesseract CLI (installed via apk) against a single rasterized
// page image. execFile, not exec -- no shell interpolation of any path.
export async function recognize(pngPath: string, languages: string, timeoutMs: number): Promise<TesseractResult> {
  try {
    const { stdout } = await execFileAsync('tesseract', [pngPath, 'stdout', '-l', languages, '--tsv'], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return parseTsv(stdout);
  } catch (error) {
    throw new TesseractError(`Tesseract failed to recognize ${pngPath}: ${(error as Error).message}`);
  }
}
