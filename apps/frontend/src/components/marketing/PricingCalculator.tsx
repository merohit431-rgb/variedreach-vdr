'use client';

import { useState } from 'react';
import { PLAN_IDS, PRICING_PLANS, calculatePricing, type PlanId } from '@variedreach-vdr/shared';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function PricingCalculator({
  initialPlan = 'STARTER',
  onChoosePlan,
}: {
  initialPlan?: PlanId;
  onChoosePlan?: (planId: PlanId, storageGb: number) => void;
}) {
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [storageGb, setStorageGb] = useState(PRICING_PLANS[initialPlan].minimumStorageGb);

  const plan = PRICING_PLANS[planId];
  const breakdown = calculatePricing(planId, storageGb);
  const belowMinimum = storageGb < plan.minimumStorageGb;

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-700">Plan</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {PLAN_IDS.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setPlanId(id);
                  setStorageGb((current) => Math.max(current, PRICING_PLANS[id].minimumStorageGb));
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  planId === id
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {PRICING_PLANS[id].name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="storage-gb" className="block text-xs font-medium text-slate-700">
            Storage required (GB)
          </label>
          <Input
            id="storage-gb"
            type="number"
            min={1}
            value={storageGb}
            onChange={(e) => setStorageGb(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1.5"
          />
          {belowMinimum && (
            <p className="mt-1 text-xs text-slate-500">
              {plan.name} has a {plan.minimumStorageGb} GB minimum commitment — billed at {plan.minimumStorageGb} GB.
            </p>
          )}
        </div>

        <div className="space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Billable storage</span>
            <span>{breakdown.billableStorageGb} GB × {formatInr(plan.ratePerGbPerMonth)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Monthly charges</span>
            <span>{formatInr(breakdown.monthlyCharges)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST (18%)</span>
            <span>{formatInr(breakdown.gst)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-semibold text-slate-900">
            <span>Total payable</span>
            <span>{formatInr(breakdown.total)} / month</span>
          </div>
        </div>

        {onChoosePlan && (
          <Button className="w-full" onClick={() => onChoosePlan(planId, breakdown.billableStorageGb)}>
            Choose {plan.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
