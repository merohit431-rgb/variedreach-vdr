import { PartialType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';

// All fields optional — the Super Admin editor sends the full record, but
// PATCH semantics keep every field individually optional.
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
