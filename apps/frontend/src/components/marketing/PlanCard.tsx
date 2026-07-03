import { Check } from 'lucide-react';
import { PRICING_PLANS, type PlanId } from '@variedreach-vdr/shared';
import { cn } from '@/lib/cn';

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

// The one place plan facts are rendered on marketing surfaces. Both the
// homepage teaser and /pricing consume this, so plan names, rates, minimums,
// and features can never drift apart again -- everything reads from the
// shared PRICING_PLANS constant.
export function PlanCard({
  planId,
  highlighted = false,
  compact = false,
  cta,
}: {
  planId: PlanId;
  highlighted?: boolean;
  compact?: boolean;
  cta: React.ReactNode;
}) {
  const plan = PRICING_PLANS[planId];
  const features = compact ? plan.features.slice(0, 4) : plan.features;

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border bg-white',
        compact ? 'p-6' : 'p-7',
        highlighted
          ? 'border-blue-600/40 shadow-card ring-1 ring-inset ring-blue-600/10'
          : 'border-slate-200 shadow-soft',
      )}
    >
      {highlighted && (
        <span className="mb-3 self-start rounded-full bg-blue-600/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          Most popular
        </span>
      )}
      <h3 className={cn('font-bold text-mk-text', compact ? 'text-lg' : 'text-xl')}>{plan.name}</h3>
      <p className="mt-1 text-xs text-mk-t4">
        Minimum {plan.minimumStorageGb} GB storage · {plan.includedUsers} users included
      </p>

      <div className="mt-5">
        <div className="flex items-baseline gap-1">
          <span className={cn('font-bold tracking-tight text-mk-text', compact ? 'text-2xl' : 'text-3xl')}>
            {formatInr(plan.ratePerGbPerMonth)}
          </span>
          <span className="text-sm text-mk-t3">/ GB / month</span>
        </div>
        <p className="mt-1 text-xs text-mk-t4">
          Min. {formatInr(plan.minimumMonthlyBilling)} / month
        </p>
      </div>

      <ul className={cn('flex-1', compact ? 'mt-5 space-y-2' : 'mt-6 space-y-2.5')}>
        {features.map((feature) => (
          <li
            key={feature}
            className={cn('flex items-start gap-2.5 text-mk-t2', compact ? 'text-xs' : 'text-sm')}
          >
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6">{cta}</div>
    </div>
  );
}
