// child_process.execFile is wrapped via util.promisify inside
// tesseract.util.ts. Mocking the raw Node-style callback function (not
// promisify itself) so promisify's own real behavior still runs against
// it -- the way the real production code path actually works, not a
// reimplementation of it.
type ExecFileCallback = (err: Error | null, result?: { stdout: string; stderr: string }) => void;
const mockExecFile = jest.fn<void, [string, string[], Record<string, unknown>, ExecFileCallback]>();
jest.mock('child_process', () => ({ execFile: (...args: unknown[]) => (mockExecFile as unknown as (...a: unknown[]) => void)(...args) }));

import { parseTsv, recognize } from './tesseract.util';

// Real Tesseract --tsv output shape: one header row, then one row per
// level (page/block/paragraph/line/word), 12 tab-separated columns ending
// in conf and text. Higher-level rows (page/block/line) report conf = -1
// and an empty text column -- only word-level rows (conf >= 0) carry both.
function tsvRow(conf: number, text: string): string {
  return ['5', '1', '1', '1', '1', '1', '0', '0', '10', '10', String(conf), text].join('\t');
}
const HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';

describe('parseTsv', () => {
  it('joins word-level rows into text and averages their confidence', () => {
    const tsv = [HEADER, tsvRow(90, 'Resolution'), tsvRow(80, 'Professional'), tsvRow(70, 'Report')].join('\n');

    const result = parseTsv(tsv);

    expect(result.text).toBe('Resolution Professional Report');
    expect(result.confidence).toBe(80);
  });

  it('ignores non-word-level rows (conf = -1) entirely -- they never contribute to text or the average', () => {
    const tsv = [
      HEADER,
      ['1', '1', '0', '0', '0', '0', '0', '0', '100', '100', '-1', ''].join('\t'), // page-level
      ['4', '1', '1', '1', '0', '0', '0', '0', '100', '20', '-1', ''].join('\t'), // line-level
      tsvRow(95, 'Word'),
    ].join('\n');

    const result = parseTsv(tsv);

    expect(result.text).toBe('Word');
    expect(result.confidence).toBe(95);
  });

  it('returns empty text and zero confidence when no word-level rows are present', () => {
    const tsv = [HEADER, ['1', '1', '0', '0', '0', '0', '0', '0', '100', '100', '-1', ''].join('\t')].join('\n');

    const result = parseTsv(tsv);

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('skips a word-level row with blank text even if its confidence is non-negative', () => {
    const tsv = [HEADER, tsvRow(60, ''), tsvRow(80, 'Real')].join('\n');

    const result = parseTsv(tsv);

    expect(result.text).toBe('Real');
    expect(result.confidence).toBe(80);
  });

  it('skips malformed rows with fewer than 12 columns rather than throwing', () => {
    const tsv = [HEADER, 'too\tfew\tcolumns', tsvRow(88, 'Valid')].join('\n');

    expect(() => parseTsv(tsv)).not.toThrow();
    expect(parseTsv(tsv).text).toBe('Valid');
  });

  it('preserves word order as given in the TSV', () => {
    const tsv = [HEADER, tsvRow(90, 'The'), tsvRow(90, 'applicant'), tsvRow(90, 'filed')].join('\n');

    expect(parseTsv(tsv).text).toBe('The applicant filed');
  });
});

// Regression test for a real bug caught live on staging (not by this spec
// file originally, since the pre-existing tests only ever mocked
// tesseract.util.ts wholesale from ocr.adapter.spec.ts and never asserted
// on recognize()'s own constructed argv): "tsv" must be a trailing
// CONFIGFILE positional argument, never a `--tsv` flag. The real Tesseract
// CLI (confirmed directly against `tesseract --help`/`--help-extra`) uses
// `tesseract input output [options] [configfile]`, where txt/pdf/tsv/hocr
// are built-in configfile names -- `--tsv` fails with "unknown command
// line argument" on the real binary, a failure no mocked test can surface
// unless it asserts on the exact argv, which is what this test now does.
describe('recognize', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('invokes the real Tesseract CLI argv shape: input, "stdout", -l <languages>, then "tsv" as a trailing positional -- never "--tsv"', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      callback(null, { stdout: `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n${tsvRow(90, 'ok')}`, stderr: '' });
    });

    await recognize('/tmp/page.png', 'eng+hin', 20000);

    expect(mockExecFile).toHaveBeenCalledWith(
      'tesseract',
      ['/tmp/page.png', 'stdout', '-l', 'eng+hin', 'tsv'],
      expect.any(Object),
      expect.any(Function),
    );
    const calledArgs = mockExecFile.mock.calls[0][1];
    expect(calledArgs).not.toContain('--tsv');
  });

  it('parses the real stdout into text + confidence via parseTsv', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      callback(null, { stdout: `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n${tsvRow(95, 'Recognized')}`, stderr: '' });
    });

    const result = await recognize('/tmp/page.png', 'eng', 20000);

    expect(result).toEqual({ text: 'Recognized', confidence: 95 });
  });

  it('wraps a CLI failure in TesseractError rather than letting the raw child_process error escape', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      callback(Object.assign(new Error('Unknown command line argument'), { code: 1 }));
    });

    await expect(recognize('/tmp/page.png', 'eng', 20000)).rejects.toThrow('Tesseract failed to recognize');
  });
});
