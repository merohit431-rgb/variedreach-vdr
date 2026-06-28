// See watermark.service.ts — default imports of CJS-only packages miscompile
// under this tsconfig (no esModuleInterop) and throw "is not a function" at
// runtime despite type-checking fine.
import PDFDocument = require('pdfkit');

const MARGIN = 40;
const ROW_HEIGHT = 20;
const HEADER_FONT_SIZE = 8;
const CELL_FONT_SIZE = 8;

export async function toPdfBuffer(
  title: string,
  headers: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - MARGIN * 2;
  const columnWidth = pageWidth / headers.length;

  doc.fontSize(16).text(title, { align: 'left' });
  doc.fontSize(9).fillColor('gray').text(`Generated ${new Date().toLocaleString()}`);
  doc.fillColor('black');
  doc.moveDown(1);

  function drawHeaderRow(y: number) {
    doc.fontSize(HEADER_FONT_SIZE).font('Helvetica-Bold');
    headers.forEach((header, index) => {
      doc.text(header, MARGIN + index * columnWidth, y, { width: columnWidth - 4, ellipsis: true });
    });
    doc.font('Helvetica');
  }

  let y = doc.y;
  drawHeaderRow(y);
  y += ROW_HEIGHT;
  doc
    .moveTo(MARGIN, y - 4)
    .lineTo(MARGIN + pageWidth, y - 4)
    .strokeColor('#cccccc')
    .stroke();

  const pageBottom = doc.page.height - MARGIN;

  for (const row of rows) {
    if (y + ROW_HEIGHT > pageBottom) {
      doc.addPage();
      y = MARGIN;
      drawHeaderRow(y);
      y += ROW_HEIGHT;
    }

    doc.fontSize(CELL_FONT_SIZE);
    row.forEach((cell, index) => {
      doc.text(String(cell), MARGIN + index * columnWidth, y, { width: columnWidth - 4, ellipsis: true });
    });
    y += ROW_HEIGHT;
  }

  doc.end();
  return done;
}
