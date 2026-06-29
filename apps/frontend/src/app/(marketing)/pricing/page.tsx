'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { PLAN_IDS, PRICING_PLANS, type PlanId } from '@variedreach-vdr/shared';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PricingCalculator } from '@/components/marketing/PricingCalculator';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function PricingPage() {
  const router = useRouter();

  function goToSignup(planId: PlanId, storageGb: number) {
    router.push(`/signup?plan=${planId}&storage=${storageGb}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Pricing</h1>
        <p className="mt-3 text-lg text-slate-600">
          Storage-based pricing with no hidden fees. Every plan includes unlimited data rooms and watermarked
          downloads.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PRICING_PLANS[id];
          return (
            <Card key={id} className={id === 'PROFESSIONAL' ? 'border-brand-300 ring-1 ring-brand-100' : undefined}>
              <CardContent className="flex h-full flex-col">
                <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Minimum {plan.minimumStorageGb} GB</p>

                <div className="mt-4">
                  <span className="text-2xl font-bold text-slate-900">{formatInr(plan.ratePerGbPerMonth)}</span>
                  <span className="text-sm text-slate-500"> / GB / month</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Minimum billing {formatInr(plan.minimumMonthlyBilling)} / month + 18% GST
                </p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-6 w-full"
                  variant={id === 'PROFESSIONAL' ? 'primary' : 'secondary'}
                  onClick={() => goToSignup(id, plan.minimumStorageGb)}
                >
                  Choose {plan.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-20 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Calculate your monthly cost</h2>
          <p className="mt-2 text-slate-600">
            Pick a plan and enter how much storage you need — pricing updates live, including GST.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Need more than 50 GB or custom terms?{' '}
            <Link href="/contact" className="font-medium text-brand-700 hover:text-brand-800">
              Talk to us
            </Link>
            .
          </p>
        </div>
        <PricingCalculator onChoosePlan={goToSignup} />
      </div>
    </div>
  );
}
