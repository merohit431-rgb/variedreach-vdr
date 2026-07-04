// Single backend source for the order amount in TRUE paise (1 INR = 100
// paise). Rates are rupees, hence ×100. GST is not charged (business not
// GST-registered) — see pricing.constants.ts in packages/shared. Used by the
// registration order + the coupon validate endpoint so they always agree.
export const PRICING_RATES: Record<string, { rate: number; minGb: number }> = {
  STARTER: { rate: 4999, minGb: 5 },
  PROFESSIONAL: { rate: 4500, minGb: 10 },
  BUSINESS: { rate: 4000, minGb: 50 },
};

export function computeOrderPaise(planId: string, storageGb: number, isYearly: boolean): number {
  const plan = PRICING_RATES[planId];
  if (!plan) return 0;
  const billableGb = Math.max(storageGb, plan.minGb);
  const monthlyPaise = billableGb * plan.rate * 100;
  return isYearly ? Math.round(monthlyPaise * 12 * 0.9) : monthlyPaise;
}
