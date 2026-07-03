import { Controller, Get, Param, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { BillingService } from './billing.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Billing')
@Controller({ path: 'billing', version: '1' })
@Roles(UserRole.ORG_ADMIN)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.listInvoices(user.organisationId);
  }

  // Scoped to the caller's own org — loadInvoice 404s a mismatched org.
  @Get('invoices/:id/pdf')
  async downloadInvoice(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoicePdf.generate(id, user.organisationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
