import ExcelJS = require('exceljs');
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { toCsv } from './csv.exporter';
import { toExcelBuffer } from './excel.exporter';
import { toPdfBuffer } from './pdf.exporter';

describe('report exporters', () => {
  const headers = ['Name', 'Count', 'Notes'];
  const rows: (string | number)[][] = [
    ['Jane Doe', 3, 'normal'],
    ['Comma, Quoted "Name"', 0, 'has special chars'],
  ];

  it('toCsv escapes commas and quotes', () => {
    const csv = toCsv(headers, rows);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Name,Count,Notes');
    expect(lines[2]).toBe('"Comma, Quoted ""Name""",0,has special chars');
  });

  it('toExcelBuffer produces a readable workbook with the right rows', async () => {
    const buffer = await toExcelBuffer('Report', headers, rows);

    const workbook = new ExcelJS.Workbook();
    // exceljs bundles its own Buffer type from an older @types/node snapshot
    // that's structurally incompatible with this project's — both are real
    // Node Buffers at runtime, so this is a type-only workaround.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Report');

    expect(sheet).toBeDefined();
    expect(sheet!.getRow(1).getCell(1).value).toBe('Name');
    expect(sheet!.getRow(2).getCell(1).value).toBe('Jane Doe');
    expect(sheet!.getRow(3).getCell(2).value).toBe(0);
  });

  it('toPdfBuffer produces a loadable, non-empty PDF', async () => {
    const buffer = await toPdfBuffer('Test Report', headers, rows);
    expect(buffer.length).toBeGreaterThan(0);

    const pdf = await PDFLibDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('toPdfBuffer paginates when rows overflow a page', async () => {
    const manyRows = Array.from({ length: 80 }, (_, i) => [`Row ${i}`, i, 'x']);
    const buffer = await toPdfBuffer('Big Report', headers, manyRows);

    const pdf = await PDFLibDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
