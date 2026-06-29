// Published V2.0 SaaS pricing. Mirrors the rates/minimums exactly as
// specified -- not derived from anything else, since these are real
// commercial terms, not internal config.
export const PLAN_IDS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface PricingPlan {
  id: PlanId;
  name: string;
  ratePerGbPerMonth: number;
  minimumStorageGb: number;
  minimumMonthlyBilling: number;
  includedUsers: number;
  features: string[];
}

export const PRICING_PLANS: Record<PlanId, PricingPlan> = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    ratePerGbPerMonth: 4999,
    minimumStorageGb: 5,
    minimumMonthlyBilling: 24995,
    includedUsers: 10,
    features: [
      '10 Users',
      'Unlimited Data Rooms',
      'Unlimited Invitations',
      'Watermarked Downloads',
      'Audit Logs',
      'Email Support',
    ],
  },
  PROFESSIONAL: {
    id: 'PROFESSIONAL',
    name: 'Professional',
    ratePerGbPerMonth: 4500,
    minimumStorageGb: 10,
    minimumMonthlyBilling: 45000,
    includedUsers: 25,
    features: [
      '25 Users',
      'Priority Support',
      'Unlimited Data Rooms',
      'Advanced Reports',
      'Watermarked Downloads',
      'Audit Logs',
    ],
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    ratePerGbPerMonth: 4000,
    minimumStorageGb: 50,
    minimumMonthlyBilling: 200000,
    includedUsers: 50,
    features: [
      '50 Users',
      'Dedicated Account Manager',
      'Unlimited Data Rooms',
      'Premium Reports',
      'Priority Support',
      'API Access (Future)',
    ],
  },
};

export const GST_RATE = 0.18;

export interface PricingBreakdown {
  billableStorageGb: number;
  monthlyCharges: number;
  gst: number;
  total: number;
}

// Billable storage never drops below a plan's minimum commitment, even if
// less is actually selected -- matches the published "Minimum Commitment" /
// "Minimum Monthly Billing" terms exactly (selecting fewer GB than the
// minimum still bills at the minimum).
export function calculatePricing(planId: PlanId, selectedStorageGb: number): PricingBreakdown {
  const plan = PRICING_PLANS[planId];
  const billableStorageGb = Math.max(selectedStorageGb, plan.minimumStorageGb);
  const monthlyCharges = billableStorageGb * plan.ratePerGbPerMonth;
  const gst = Math.round(monthlyCharges * GST_RATE);
  const total = monthlyCharges + gst;

  return { billableStorageGb, monthlyCharges, gst, total };
}
