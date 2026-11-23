import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class GhostscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GhostscriptError';
  }
}

// Rasterizes exactly ONE page of a PDF to a PNG via the Ghostscript CLI
// (installed via apk, see Dockerfile) -- execFile, not exec, so no shell
// interpolation of any path is ever possible. -dFirstPage/-dLastPage bound
// Ghostscript to a single page so a large multi-page scanned PDF is never
// rasterized in full just to OCR a handful of flagged pages.
export async function rasterizePage(pdfPath: string, pageNumber: number, dpi: number, outputPngPath: string, timeoutMs: number): Promise<void> {
  try {
    await execFileAsync(
      'gs',
      [
        '-dNOPAUSE',
        '-dBATCH',
        '-dSAFER',
        `-dFirstPage=${pageNumber}`,
        `-dLastPage=${pageNumber}`,
        `-r${dpi}`,
        '-sDEVICE=png16m',
        `-o${outputPngPath}`,
        pdfPath,
      ],
      { timeout: timeoutMs },
    );
  } catch (error) {
    throw new GhostscriptError(`Ghostscript failed to rasterize page ${pageNumber}: ${(error as Error).message}`);
  }
}
