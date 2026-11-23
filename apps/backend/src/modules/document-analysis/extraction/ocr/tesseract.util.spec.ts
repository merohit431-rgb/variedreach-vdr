import { parseTsv } from './tesseract.util';

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
