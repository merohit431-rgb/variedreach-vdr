import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeEmail } from '../../common/utils/email.util';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

export interface CouponValidation {
  valid: boolean;
  reason?: string;
  code?: string;
  type?: 'PERCENT' | 'FIXED';
  discountPaisa: number;
  finalPaisa: number;
}

// A Postgres transaction client or the base client — redeem() runs inside the
// provisioning transaction so the redemption row and the discounted invoice
// commit together.
type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Server-authoritative validation + discount resolution ──
  // The client never computes the discount; this is the single source used by
  // both the public validate endpoint and create-order.
  async resolve(
    rawCode: string,
    planId: string,
    amountPaisa: number,
    email?: string,
  ): Promise<CouponValidation> {
    const code = rawCode.trim().toUpperCase();
    const fail = (reason: string): CouponValidation => ({ valid: false, reason, discountPaisa: 0, finalPaisa: amountPaisa });

    if (!code) return fail('Enter a coupon code');

    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return fail('Invalid coupon code');
    if (coupon.status !== 'ACTIVE') return fail('This coupon is no longer active');

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) return fail('This coupon is not valid yet');
    if (coupon.validUntil && now > coupon.validUntil) return fail('This coupon has expired');
    if (coupon.minOrderPaisa && amountPaisa < coupon.minOrderPaisa)
      return fail(`Order must be at least ₹${(coupon.minOrderPaisa / 100).toLocaleString('en-IN')} to use this coupon`);
    if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planId))
      return fail('This coupon is not valid for the selected plan');

    if (coupon.maxRedemptions) {
      const total = await this.prisma.couponRedemption.count({ where: { couponId: coupon.id } });
      if (total >= coupon.maxRedemptions) return fail('This coupon has reached its usage limit');
    }
    if (coupon.perCustomerLimit && email) {
      const mine = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, email: normalizeEmail(email) },
      });
      if (mine >= coupon.perCustomerLimit) return fail('You have already used this coupon');
    }

    const discountPaisa = this.computeDiscount(coupon, amountPaisa);
    if (discountPaisa <= 0) return fail('This coupon does not apply to your order');

    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      discountPaisa,
      finalPaisa: Math.max(0, amountPaisa - discountPaisa),
    };
  }

  private computeDiscount(coupon: Coupon, amountPaisa: number): number {
    let discount =
      coupon.type === 'PERCENT'
        ? Math.floor((amountPaisa * coupon.value) / 100)
        : coupon.value;
    if (coupon.type === 'PERCENT' && coupon.maxDiscountPaisa) {
      discount = Math.min(discount, coupon.maxDiscountPaisa);
    }
    return Math.min(discount, amountPaisa); // never exceed the order
  }

  // Records a redemption. Runs inside the provisioning transaction.
  async redeem(
    db: Db,
    code: string,
    discountPaisa: number,
    email: string,
    organisationId: string,
  ): Promise<void> {
    const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) return;
    await db.couponRedemption.create({
      data: { couponId: coupon.id, organisationId, email: normalizeEmail(email), discountPaisa },
    });
  }

  // ── Super Admin CRUD ──
  async list(search?: string) {
    const where: Prisma.CouponWhereInput = search
      ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }
      : {};
    const coupons = await this.prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return coupons.map((c) => ({ ...c, redemptionCount: c._count.redemptions }));
  }

  async getById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return { ...coupon, redemptionCount: coupon._count.redemptions };
  }

  private toData(dto: CreateCouponDto | UpdateCouponDto) {
    return {
      ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.value !== undefined && { value: dto.value }),
      minOrderPaisa: dto.minOrderPaisa ?? null,
      maxDiscountPaisa: dto.maxDiscountPaisa ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      maxRedemptions: dto.maxRedemptions ?? null,
      perCustomerLimit: dto.perCustomerLimit ?? null,
      ...(dto.applicablePlans !== undefined && { applicablePlans: dto.applicablePlans }),
      ...(dto.status !== undefined && { status: dto.status }),
      description: dto.description ?? null,
      internalNotes: dto.internalNotes ?? null,
    };
  }

  async create(dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('A coupon with this code already exists');
    return this.prisma.coupon.create({ data: this.toData(dto) as Prisma.CouponCreateInput });
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.getById(id);
    if (dto.code) {
      const clash = await this.prisma.coupon.findFirst({
        where: { code: dto.code.trim().toUpperCase(), id: { not: id } },
      });
      if (clash) throw new BadRequestException('Another coupon already uses this code');
    }
    return this.prisma.coupon.update({ where: { id }, data: this.toData(dto) });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  // Clone with a unique code, DISABLED so it's reviewed before going live.
  async duplicate(id: string) {
    const src = await this.prisma.coupon.findUnique({ where: { id } });
    if (!src) throw new NotFoundException('Coupon not found');
    let code = `${src.code}-COPY`;
    let n = 1;
    while (await this.prisma.coupon.findUnique({ where: { code } })) code = `${src.code}-COPY${n++}`;
    return this.prisma.coupon.create({
      data: {
        code,
        type: src.type,
        value: src.value,
        minOrderPaisa: src.minOrderPaisa,
        maxDiscountPaisa: src.maxDiscountPaisa,
        validFrom: src.validFrom,
        validUntil: src.validUntil,
        maxRedemptions: src.maxRedemptions,
        perCustomerLimit: src.perCustomerLimit,
        applicablePlans: src.applicablePlans,
        status: 'DISABLED',
        description: src.description,
        internalNotes: src.internalNotes,
      },
    });
  }

  async listRedemptions(id: string) {
    await this.getById(id);
    return this.prisma.couponRedemption.findMany({
      where: { couponId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportRedemptionsCsv(id: string): Promise<string> {
    const coupon = await this.getById(id);
    const rows = await this.listRedemptions(id);
    const header = 'Coupon,Email,Discount (INR),Organisation ID,Redeemed At';
    const lines = rows.map((r) =>
      [coupon.code, r.email, (r.discountPaisa / 100).toFixed(2), r.organisationId ?? '', r.createdAt.toISOString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }
}
