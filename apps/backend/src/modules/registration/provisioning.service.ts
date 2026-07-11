import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CouponService } from '../coupon/coupon.service';
import { AuditLogService } from '../audit/audit-log.service';

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
    private readonly auditLogService: AuditLogService,
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
          // Without this, storageLimitGb falls back to the schema default (25)
          // -- the org's actual enforced cap (read everywhere via
          // getOrgStorageUsage) would silently disagree with what the
          // customer selected and paid for (amounts.billableGb, already
          // floored to the plan minimum above).
          storageLimitGb: amounts.billableGb,
          ...(reg.gstNumber && { gstNumber: reg.gstNumber }),
          ...(reg.companyAddress && { address: reg.companyAddress }),
          ...(reg.mobileNumber && { mobileNumber: reg.mobileNumber }),
        },
      });

      // Email is a global identity, not scoped to one organisation -- someone
      // who's already a PRA/Auditor/etc. on another engagement must still be
      // able to buy their own workspace. Reuse the existing User row rather
      // than creating a second one (which used to throw a unique-constraint
      // violation on email here, deep inside the transaction, *after*
      // Razorpay had already captured a real payment with no way to
      // fulfill it -- this is the actual fix for that). Never touch an
      // existing user's password/name; only their own account-settings flow
      // should change those.
      let user = await tx.user.findUnique({ where: { email: reg.email } });
      if (!user) {
        const nameParts = reg.fullName.trim().split(/\s+/);
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

        user = await tx.user.create({
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
      }

      // Every organisation this identity buys gets its own membership --
      // always a fresh row since org.id was just created above, so this can
      // never collide with an existing (userId, organisationId) pair.
      await tx.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: 'ORG_ADMIN', isOwner: true },
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
        data: { provisionedAt: now, paymentStatus: 'COMPLETED' },
      });

      return { org, user, invoiceNumber };
    });

    // Single shared audit entry for every successful payment, regardless of
    // which caller reached this method (the normal client-redirect checkout,
    // or the Razorpay webhook rescuing an interrupted one) -- previously
    // neither path logged anything here at all.
    await this.auditLogService.record({
      action: 'PAYMENT_CAPTURED',
      userId: user.id,
      organisationId: org.id,
      resourceType: 'Organisation',
      resourceId: org.id,
      metadata: {
        invoiceNumber,
        amountPaisa: netTotal,
        planSlug: reg.selectedPlan,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        gatewayOrderId: reg.gatewayOrderId,
        gatewayPaymentId: gateway?.paymentId ?? null,
      },
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

    // 'ORG_ADMIN' explicitly, not user.role -- for a reused identity,
    // user.role reflects whatever role they hold elsewhere (e.g. PRA on a
    // different org), not their role in the org just created here, which
    // is always ORG_ADMIN (see the OrganisationMembership created above).
    return { organisationId: org.id, userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: 'ORG_ADMIN' };
  }
}
