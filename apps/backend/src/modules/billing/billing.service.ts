import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // Invoices for the caller's own organisation (org-admin billing view).
  async listInvoices(organisationId: string) {
    return this.prisma.invoice.findMany({
      where: { organisationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        amountPaisa: true,
        gstAmountPaisa: true,
        totalAmountPaisa: true,
        status: true,
        issuedAt: true,
        paidAt: true,
        createdAt: true,
        subscription: { select: { planSlug: true, billingCycle: true } },
      },
    });
  }
}
