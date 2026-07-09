import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CouponService } from '../coupon/coupon.service';

// Mirror of packages/shared/src/constants/pricing.constants.ts
// (cannot be imported directly — shared package ships raw TS with no build step)
const PRICING_PLANS: Record<string, { name: string; ratePerGbPerMonth: number; minimumStorageGb: number; minimumMonthlyBilling: number; includedUsers: number }> = {
  STARTER:      { name: 'Starter',      ratePerGbPerMonth: 4999, minimumStorageGb: 5,  minimumMonthlyBilling: 24995,  includedUsers: 10 },
  PROFESSIONAL: { name: 'Professional', ratePerGbPerMonth: 4500, minimumStorageGb: 10, minimumMonthlyBilling: 45000,  includedUsers: 25 },
  BUSINESS:     { name: 'Business',     ratePerGbPerMonth: 4000, minimumStorageGb: 50, minimumMonthlyBilling: 200000, includedUsers: 50 },
};
// GST is not charged — business is not registered under GST. Kept as a flag
// (mirrors packages/shared pricing.constants.ts) so it can be re-enabled
// centrally once registration is obtained. gst stays in the shape as 0 for
// backwards compatibility with the Invoice.gstAmountPaisa column.
const GST_RATE = 0.18;
const GST_ENABLED = false;

// All amounts in TRUE paise (1 INR = 100 paise) — the *Paisa columns and the
// gateway order must agree, and every money display divides by 100. Plan
// rates are rupees, hence ×100.
function computeAmounts(planId: string, storageGb: number, isYearly: boolean) {
  const plan = PRICING_PLANS[planId];
  const billableGb = Math.max(storageGb, plan.minimumStorageGb);
  const monthlyBase = billableGb * plan.ratePerGbPerMonth * 100;
  const base = isYearly ? Math.round(monthlyBase * 12 * 0.9) : monthlyBase;
  const gst = GST_ENABLED ? Math.round(base * GST_RATE) : 0;
  return { billableGb, monthlyBase, base, gst, total: base + gst };
}

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly couponService: CouponService,
  ) {}

  async provision(
    registrationId: string,
    gateway?: { paymentId?: string; signature?: string },
  ): Promise<{ organisationId: string; userId: string; email: string; firstName: string; lastName: string; role: string }> {
    const reg = await this.prisma.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new BadRequestException('Registration not found');
    if (!reg.verifiedAt) throw new BadRequestException('Email not verified');
    if (reg.provisionedAt) throw new BadRequestException('Already provisioned');

    const plan = PRICING_PLANS[reg.selectedPlan];
    if (!plan) throw new BadRequestException('Invalid plan');

    const isYearly = reg.billingCycle === 'YEARLY';
    const amounts = computeAmounts(reg.selectedPlan, reg.selectedStorageGb, isYearly);
    // Coupon discount was resolved + stored at create-order; clamp defensively.
    const discountPaisa = Math.min(Math.max(0, reg.discountPaisa ?? 0), amounts.total);
    const netTotal = amounts.total - discountPaisa;
    const now = new Date();
    const periodEnd = new Date(now);
    isYearly ? periodEnd.setFullYear(periodEnd.getFullYear() + 1) : periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { org, user, invoiceNumber } = await this.prisma.$transaction(async (tx) => {
      // Unique slug from companyName
      const base = reg.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      let slug = base;
      let n = 1;
      while (await tx.organisation.findUnique({ where: { slug } })) {
        slug = `${base}-${n++}`;
      }

      const org = await tx.organisation.create({
        data: {
          name: reg.companyName,
          slug,
          planSlug: reg.selectedPlan,
          userLimit: plan.includedUsers,
          ...(reg.gstNumber && { gstNumber: reg.gstNumber }),
          ...(reg.companyAddress && { address: reg.companyAddress }),
          ...(reg.mobileNumber && { mobileNumber: reg.mobileNumber }),
        },
      });

      const nameParts = reg.fullName.trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      const user = await tx.user.create({
        data: {
          email: reg.email,
          firstName,
          lastName,
          password: reg.passwordHash,
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
          organisationId: org.id,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          organisationId: org.id,
          planSlug: reg.selectedPlan,
          billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
          storageGb: amounts.billableGb,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      const payment = await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          organisationId: org.id,
          amountPaisa: netTotal, // what was actually charged (after discount)
          status: 'SUCCESSFUL',
          ...(reg.gatewayOrderId && { gatewayOrderId: reg.gatewayOrderId }),
          ...(gateway?.paymentId && { gatewayPaymentId: gateway.paymentId }),
          ...(gateway?.signature && { gatewaySignature: gateway.signature }),
          paidAt: now,
        },
      });

      // INV-YYYY-NNNNNN — sequenced within current year
      const year = now.getFullYear();
      const lastInv = await tx.invoice.findFirst({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      const seq = lastInv ? parseInt(lastInv.invoiceNumber.split('-')[2], 10) + 1 : 1;
      const invoiceNumber = `INV-${year}-${String(seq).padStart(6, '0')}`;

      const lineItems: Array<{ description: string; quantity: number; unitPricePaisa: number; amountPaisa: number }> = [
        {
          description: `${plan.name} Plan – ${isYearly ? 'Annual' : 'Monthly'} (${amounts.billableGb} GB storage)`,
          quantity: isYearly ? 12 : 1,
          unitPricePaisa: amounts.monthlyBase,
          amountPaisa: amounts.base,
        },
      ];
      if (discountPaisa > 0) {
        lineItems.push({
          description: `Discount${reg.couponCode ? ` (coupon ${reg.couponCode})` : ''}`,
          quantity: 1,
          unitPricePaisa: -discountPaisa,
          amountPaisa: -discountPaisa,
        });
      }

      await tx.invoice.create({
        data: {
          subscriptionId: subscription.id,
          organisationId: org.id,
          paymentId: payment.id,
          invoiceNumber,
          amountPaisa: amounts.base,
          gstAmountPaisa: amounts.gst,
          totalAmountPaisa: netTotal,
          status: 'PAID',
          issuedAt: now,
          paidAt: now,
          lineItems,
          ...(reg.gstNumber && { customerGstNumber: reg.gstNumber }),
        },
      });

      // Record the coupon redemption in the same transaction as the invoice.
      if (reg.couponCode && discountPaisa > 0) {
        await this.couponService.redeem(tx, reg.couponCode, discountPaisa, reg.email, org.id);
      }

      await tx.registration.update({
        where: { id: reg.id },
        data: { provisionedAt: now },
      });

      return { org, user, invoiceNumber };
    });

    // Fire-and-forget payment-success + welcome email with the receipt summary.
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const amountLabel = `INR ${(netTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    void this.mailService.sendSubscriptionActivatedEmail(reg.email, reg.fullName, plan.name, {
      userId: user.id,
      invoiceNumber,
      amountLabel,
      storageGb: amounts.billableGb,
      billingCycle: isYearly ? 'Yearly' : 'Monthly',
      loginUrl: frontendUrl ? `${frontendUrl}/dashboard` : undefined,
    });

    return { organisationId: org.id, userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role };
  }
}
