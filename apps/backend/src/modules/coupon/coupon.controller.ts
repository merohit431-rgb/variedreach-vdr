import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { computeOrderPaise } from '../../common/pricing.util';

@ApiTags('Coupons')
@Controller({ path: 'coupons', version: '1' })
export class CouponController {
  constructor(private readonly service: CouponService) {}

  // Public: validate a code against a plan/storage/cycle. The server computes
  // the order amount and the discount — the client never decides either.
  @Public()
  @Throttle({ global: { ttl: 60, limit: 20 } })
  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto) {
    const amountPaisa = computeOrderPaise(dto.planId, dto.storageGb, dto.billingCycle === 'YEARLY');
    return this.service.resolve(dto.code, dto.planId, amountPaisa, dto.email);
  }

  // ── Super Admin ──
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.service.create(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.service.update(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.service.duplicate(id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get(':id/redemptions')
  redemptions(@Param('id') id: string) {
    return this.service.listRedemptions(id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get(':id/redemptions/export')
  async exportRedemptions(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.service.exportRedemptionsCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="coupon-usage.csv"');
    res.send(csv);
  }
}
