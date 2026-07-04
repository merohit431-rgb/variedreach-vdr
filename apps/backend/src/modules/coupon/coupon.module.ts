import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';

@Module({
  controllers: [CouponController],
  providers: [CouponService],
  // Exported so RegistrationModule (create-order + provisioning) can apply
  // and redeem coupons.
  exports: [CouponService],
})
export class CouponModule {}
