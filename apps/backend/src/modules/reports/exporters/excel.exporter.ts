// See watermark.service.ts — default imports of CJS-only packages miscompile
// under this tsconfig (no esModuleInterop) and throw at runtime ("Cannot read
// properties of undefined") despite type-checking fine.
import ExcelJS = require('exceljs');

export async function toExcelBuffer(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.addRow(headers).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
