import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { IPaymentProvider, PAYMENT_PROVIDER } from '../payment/payment-provider.interface';
import { ProvisioningService } from './provisioning.service';
import { CouponService } from '../coupon/coupon.service';
import { generateOpaqueToken, sha256Hex } from '../../common/utils/crypto.util';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';

const BCRYPT_ROUNDS = 12;

// Mirror of packages/shared pricing — same as provisioning.service.ts
const PRICING_PLANS: Record<string, { name: string; ratePerGbPerMonth: number; minimumStorageGb: number }> = {
  STARTER:      { name: 'Starter',      ratePerGbPerMonth: 4999, minimumStorageGb: 5  },
  PROFESSIONAL: { name: 'Professional', ratePerGbPerMonth: 4500, minimumStorageGb: 10 },
  BUSINESS:     { name: 'Business',     ratePerGbPerMonth: 4000, minimumStorageGb: 50 },
};
// GST not charged (business not GST-registered). Kept as a flag so the order
// amount, provisioning, and the invoice all agree — the gateway must charge
// exactly what the invoice shows. Re-enable centrally with the same flag in
// pricing.constants.ts / provisioning.service.ts when GST registration lands.
const GST_RATE = 0.18;
const GST_ENABLED = false;

// Returns the amount in TRUE paise (1 INR = 100 paise). The plan rates are in
// rupees, so ×100 — this is what the payment gateway is charged and what the
// invoice stores, so displays (which divide by 100) render the real rupee
// amount and Razorpay charges the correct sum.
function computeTotal(planId: string, storageGb: number, isYearly: boolean): number {
  const plan = PRICING_PLANS[planId];
  const billableGb = Math.max(storageGb, plan.minimumStorageGb);
  const monthlyBasePaise = billableGb * plan.ratePerGbPerMonth * 100;
  const basePaise = isYearly ? Math.round(monthlyBasePaise * 12 * 0.9) : monthlyBasePaise;
  return GST_ENABLED ? basePaise + Math.round(basePaise * GST_RATE) : basePaise;
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: IPaymentProvider,
    private readonly provisioningService: ProvisioningService,
    private readonly couponService: CouponService,
  ) {}

  async register(dto: CreateRegistrationDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.registration.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email has already been registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const registration = await this.prisma.registration.create({
      data: {
        fullName: dto.fullName,
        companyName: dto.companyName,
        email,
        mobileNumber: dto.mobileNumber,
        passwordHash,
        gstNumber: dto.gstNumber,
        companyAddress: dto.companyAddress,
        selectedPlan: dto.selectedPlan,
        selectedStorageGb: dto.selectedStorageGb,
      },
    });

    await this.issueVerificationToken(registration.id, registration.fullName, registration.email);
  }

  async verifyEmail(token: string): Promise<{ email: string }> {
    const tokenHash = sha256Hex(token);
    const registration = await this.prisma.registration.findUnique({ where: { verificationTokenHash: tokenHash } });

    if (
      !registration ||
      registration.verifiedAt ||
      !registration.verificationExpiresAt ||
      registration.verificationExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    await this.prisma.registration.update({
      where: { id: registration.id },
      data: { verifiedAt: new Date(), verificationTokenHash: null, verificationExpiresAt: null },
    });

    return { email: registration.email };
  }

  async resendVerification(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const registration = await this.prisma.registration.findUnique({ where: { email } });

    // Same shape regardless of whether the email exists or is already
    // verified -- avoids using this endpoint to enumerate registrations.
    if (!registration || registration.verifiedAt) {
      return;
    }

    await this.issueVerificationToken(registration.id, registration.fullName, registration.email);
  }

  async createOrder(dto: CreateOrderDto): Promise<{ orderId: string; amountPaisa: number; discountPaisa: number; couponCode: string | null; currency: string; keyId: string; planName: string; billingCycle: string }> {
    const reg = await this.prisma.registration.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!reg || !reg.verifiedAt) throw new BadRequestException('Email not verified or registration not found');
    if (reg.provisionedAt) throw new BadRequestException('Account already provisioned');

    const billingCycle = dto.billingCycle ?? reg.billingCycle ?? 'MONTHLY';
    const isYearly = billingCycle === 'YEARLY';
    const grossPaisa = computeTotal(reg.selectedPlan, reg.selectedStorageGb, isYearly);

    // Coupon (optional) — resolved server-side; the gateway is charged the
    // discounted amount and the discount is stored for the invoice.
    let discountPaisa = 0;
    let couponCode: string | null = null;
    if (dto.couponCode) {
      const v = await this.couponService.resolve(dto.couponCode, reg.selectedPlan, grossPaisa, reg.email);
      if (!v.valid) throw new BadRequestException(v.reason ?? 'This coupon cannot be applied');
      discountPaisa = v.discountPaisa;
      couponCode = v.code ?? null;
    }
    const amountPaisa = Math.max(0, grossPaisa - discountPaisa);

    const receipt = `reg_${reg.id.replace(/-/g, '').slice(0, 20)}`;
    const order = await this.paymentProvider.createOrder({ amountPaisa, receipt });

    await this.prisma.registration.update({
      where: { id: reg.id },
      data: { gatewayOrderId: order.orderId, billingCycle, couponCode, discountPaisa },
    });

    const plan = PRICING_PLANS[reg.selectedPlan];
    return {
      orderId: order.orderId,
      amountPaisa: order.amountPaisa,
      discountPaisa,
      couponCode,
      currency: 'INR',
      keyId: order.keyId,
      planName: plan.name,
      billingCycle,
    };
  }

  async getDetails(email: string): Promise<{ selectedPlan: string; selectedStorageGb: number; billingCycle: string } | null> {
    const reg = await this.prisma.registration.findUnique({
      where: { email },
      select: { verifiedAt: true, provisionedAt: true, selectedPlan: true, selectedStorageGb: true, billingCycle: true },
    });
    if (!reg || !reg.verifiedAt || reg.provisionedAt) return null;
    return { selectedPlan: reg.selectedPlan, selectedStorageGb: reg.selectedStorageGb, billingCycle: reg.billingCycle };
  }

  async complete(dto: CompleteRegistrationDto): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date; user: { id: string; email: string; firstName: string; lastName: string; role: string; organisationId: string } }> {
    const reg = await this.prisma.registration.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!reg || !reg.verifiedAt) throw new BadRequestException('Email not verified or registration not found');
    if (reg.provisionedAt) throw new BadRequestException('Account already provisioned');
    if (reg.gatewayOrderId !== dto.gatewayOrderId) throw new BadRequestException('Order ID mismatch');

    const valid = await this.paymentProvider.verifyPayment({
      orderId: dto.gatewayOrderId,
      paymentId: dto.gatewayPaymentId,
      signature: dto.gatewaySignature,
    });
    if (!valid) throw new BadRequestException('Payment verification failed');

    const provisioned = await this.provisioningService.provision(reg.id);

    const tokens = await this.authService.issueTokensForUser(
      provisioned.userId,
      provisioned.email,
      provisioned.role,
      provisioned.organisationId,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
      user: {
        id: provisioned.userId,
        email: provisioned.email,
        firstName: provisioned.firstName,
        lastName: provisioned.lastName,
        role: provisioned.role,
        organisationId: provisioned.organisationId,
      },
    };
  }

  private async issueVerificationToken(registrationId: string, fullName: string, email: string): Promise<void> {
    const { raw, hash } = generateOpaqueToken();
    const expiresHours = this.configService.get<number>('jwt.registrationVerificationExpiresHours')!;

    await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        verificationTokenHash: hash,
        verificationExpiresAt: new Date(Date.now() + expiresHours * 60 * 60_000),
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const verifyUrl = `${frontendUrl}/verify-email?token=${raw}`;

    await this.mailService.sendEmailVerificationEmail(email, fullName, verifyUrl);
  }
}
