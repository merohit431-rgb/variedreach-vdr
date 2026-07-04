import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessProfileService } from '../business-profile/business-profile.service';

const NAVY = '#0A4DA3';
const INK = '#0F172A';
const MUTE = '#64748B';
const FAINT = '#94A3B8';
const LINE = '#E2E8F0';
const BG = '#F8FAFC';
const GREEN = '#0F766E';

function inr(paise: number): string {
  return `INR ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface LineItem {
  description: string;
  quantity: number;
  unitPricePaisa: number;
  amountPaisa: number;
}

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessProfile: BusinessProfileService,
  ) {}

  // Loads the invoice with everything the document needs. organisationId, when
  // passed, scopes access to the caller's own org (org-admin); super-admin
  // passes undefined.
  async loadInvoice(invoiceId: string, organisationId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: true,
        payment: true,
        organisation: {
          include: {
            users: {
              where: { role: 'ORG_ADMIN', deletedAt: null },
              select: { firstName: true, lastName: true, email: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (organisationId && invoice.organisationId !== organisationId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async generate(invoiceId: string, organisationId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.loadInvoice(invoiceId, organisationId);
    const seller = await this.businessProfile.get();

    const buffer = await this.render(invoice, seller);
    return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
  }

  private render(
    invoice: Awaited<ReturnType<InvoicePdfService['loadInvoice']>>,
    seller: Awaited<ReturnType<BusinessProfileService['get']>>,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const org = invoice.organisation;
    const admin = org.users[0];
    const sub = invoice.subscription;
    const payment = invoice.payment;
    const items = (invoice.lineItems as unknown as LineItem[]) ?? [];
    const left = 50;
    const right = doc.page.width - 50;
    const paid = invoice.status === 'PAID';

    // ── Header: brand lockup (left) + INVOICE meta (right) ──
    doc.fillColor(NAVY).font('Helvetica-BoldOblique').fontSize(22).text(seller.businessName.toUpperCase(), left, 52);
    doc.fillColor(MUTE).font('Helvetica').fontSize(9).text(seller.tagline, left, 78);

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(22).text('INVOICE', 0, 52, { align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTE).text(invoice.invoiceNumber, 0, 80, { align: 'right' });
    doc
      .roundedRect(right - 78, 96, 78, 18, 4)
      .fillColor(paid ? '#DCFCE7' : '#FEF9C3')
      .fill();
    doc.fillColor(paid ? GREEN : '#854D0E').font('Helvetica-Bold').fontSize(9).text(invoice.status, right - 78, 101, { width: 78, align: 'center' });

    doc.moveTo(left, 128).lineTo(right, 128).strokeColor(LINE).lineWidth(1).stroke();

    // ── Seller / Bill-to columns ──
    const colY = 144;
    doc.fillColor(FAINT).font('Helvetica-Bold').fontSize(8).text('BILLED FROM', left, colY);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(seller.legalName, left, colY + 14);
    doc.fillColor(MUTE).font('Helvetica').fontSize(9);
    doc.text(seller.address, left, colY + 30, { width: 220 });
    doc.text(`PAN: ${seller.pan}`, left, doc.y + 2);
    doc.text(seller.gstNumber ? `GSTIN: ${seller.gstNumber}` : 'Not registered under GST', left, doc.y + 2);
    doc.fillColor(NAVY).text(seller.supportEmail, left, doc.y + 2);

    const rcol = 320;
    doc.fillColor(FAINT).font('Helvetica-Bold').fontSize(8).text('BILLED TO', rcol, colY);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(org.name, rcol, colY + 14, { width: right - rcol });
    doc.fillColor(MUTE).font('Helvetica').fontSize(9);
    if (admin) doc.text(`${admin.firstName} ${admin.lastName}`, rcol, colY + 30, { width: right - rcol });
    if (admin) doc.text(admin.email, rcol, doc.y + 2, { width: right - rcol });
    if (org.address) doc.text(org.address, rcol, doc.y + 2, { width: right - rcol });
    if (org.gstNumber) doc.text(`GSTIN: ${org.gstNumber}`, rcol, doc.y + 2);

    // ── Meta strip: dates, txn, gateway ──
    const metaY = 268;
    doc.roundedRect(left, metaY, right - left, 56, 6).fillColor(BG).fill();
    const metas: [string, string][] = [
      ['Issue date', fmtDate(invoice.issuedAt ?? invoice.createdAt)],
      ['Payment date', fmtDate(invoice.paidAt ?? payment?.paidAt)],
      ['Billing period', `${fmtDate(sub.currentPeriodStart)} — ${fmtDate(sub.currentPeriodEnd)}`],
      ['Payment method', payment?.gatewayPaymentId ? 'Razorpay' : 'Online'],
      ['Transaction ID', payment?.gatewayPaymentId ?? payment?.gatewayOrderId ?? '—'],
      ['Billing cycle', sub.billingCycle],
    ];
    const cellW = (right - left) / 3;
    metas.forEach(([label, value], i) => {
      const cx = left + (i % 3) * cellW + 12;
      const cy = metaY + (i < 3 ? 10 : 30);
      doc.fillColor(FAINT).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), cx, cy);
      doc.fillColor(INK).font('Helvetica').fontSize(9).text(value, cx, cy + 9, { width: cellW - 18, ellipsis: true });
    });

    // ── Line items table ──
    let y = metaY + 78;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8);
    doc.text('DESCRIPTION', left, y);
    doc.text('QTY', 330, y, { width: 40, align: 'right' });
    doc.text('UNIT PRICE', 380, y, { width: 70, align: 'right' });
    doc.text('AMOUNT', right - 90, y, { width: 90, align: 'right' });
    y += 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 10;

    doc.font('Helvetica').fontSize(9).fillColor(INK);
    for (const item of items) {
      doc.fillColor(INK).text(item.description, left, y, { width: 270 });
      doc.fillColor(MUTE).text(String(item.quantity), 330, y, { width: 40, align: 'right' });
      doc.text(inr(item.unitPricePaisa), 380, y, { width: 70, align: 'right' });
      doc.fillColor(INK).text(inr(item.amountPaisa), right - 90, y, { width: 90, align: 'right' });
      y = doc.y + 10;
    }

    // Plan facts line
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 10;
    doc.fillColor(MUTE).font('Helvetica').fontSize(8).text(
      `Plan: ${sub.planSlug}  ·  Storage: ${sub.storageGb} GB  ·  User limit: ${org.userLimit}  ·  Cycle: ${sub.billingCycle}`,
      left,
      y,
    );

    // ── Totals box ──
    y += 24;
    const boxX = right - 220;
    const discountPaisa = invoice.amountPaisa + invoice.gstAmountPaisa - invoice.totalAmountPaisa;
    const rowsT: [string, string, boolean][] = [
      ['Subtotal', inr(invoice.amountPaisa), false],
    ];
    if (discountPaisa > 0) rowsT.push(['Discount', `- ${inr(discountPaisa)}`, false]);
    if (invoice.gstAmountPaisa > 0) rowsT.push(['GST', inr(invoice.gstAmountPaisa), false]);
    rowsT.push(['Total paid', inr(invoice.totalAmountPaisa), true]);
    for (const [label, value, strong] of rowsT) {
      if (strong) {
        doc.roundedRect(boxX, y - 6, 220, 26, 4).fillColor(NAVY).fill();
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11);
        doc.text(label, boxX + 12, y + 1);
        doc.text(value, boxX + 12, y + 1, { width: 196, align: 'right' });
        y += 26;
      } else {
        doc.fillColor(MUTE).font('Helvetica').fontSize(10);
        doc.text(label, boxX + 12, y);
        doc.fillColor(INK).text(value, boxX + 12, y, { width: 196, align: 'right' });
        y += 18;
      }
    }
    doc.fillColor(FAINT).font('Helvetica').fontSize(8).text('Currency: INR (Indian Rupee)', boxX + 12, y + 2, { width: 196, align: 'right' });

    // ── Footer pinned to bottom ──
    const footY = doc.page.height - 92;
    doc.moveTo(left, footY).lineTo(right, footY).strokeColor(LINE).stroke();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(`${seller.businessName} — ${seller.tagline}`, left, footY + 10);
    doc.fillColor(MUTE).font('Helvetica').fontSize(8).text(
      `Support: ${seller.supportEmail}  ·  ${seller.supportPhone}  ·  ${seller.website}`,
      left,
      footY + 24,
    );
    doc.fillColor(FAINT).fontSize(8).text(
      'This is a system-generated invoice and does not require a signature.',
      left,
      footY + 40,
    );

    doc.end();
    return done;
  }
}
