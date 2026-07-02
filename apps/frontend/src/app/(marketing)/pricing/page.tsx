'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { PLAN_IDS, PRICING_PLANS, type PlanId } from '@variedreach-vdr/shared';
import { PricingCalculator } from '@/components/marketing/PricingCalculator';
import { cn } from '@/lib/cn';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function PricingPage() {
  const router = useRouter();

  function goToSignup(planId: PlanId, storageGb: number) {
    router.push(`/signup?plan=${planId}&storage=${storageGb}`);
  }

  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Pricing
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            Pay for storage. Everything else is included.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            No per-user seat fees. No feature gating. Watermarking, RBAC, audit trail, office preview, and
            cloud import are included on every plan. You pay for the storage you need.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {PLAN_IDS.map((id) => {
              const plan = PRICING_PLANS[id];
              const isHighlighted = id === 'PROFESSIONAL';
              return (
                <div
                  key={id}
                  className={cn(
                    'flex flex-col rounded-xl border p-7',
                    isHighlighted
                      ? 'border-blue-500/40 bg-blue-500/[0.06]'
                      : 'border-white/[0.06] bg-mk-bg',
                  )}
                >
                  {isHighlighted && (
                    <span className="mb-3 self-start rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-xl font-bold text-mk-text">{plan.name}</h2>
                  <p className="mt-1 text-xs text-mk-t4">Minimum {plan.minimumStorageGb} GB storage</p>

                  <div className="mt-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-mk-text">
                        {formatInr(plan.ratePerGbPerMonth)}
                      </span>
                      <span className="text-sm text-mk-t3">/ GB / month</span>
                    </div>
                    <p className="mt-1 text-xs text-mk-t4">
                      Min. {formatInr(plan.minimumMonthlyBilling)} / month + 18% GST
                    </p>
                  </div>

                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-mk-t2">
                        <Check
                          className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400"
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => goToSignup(id, plan.minimumStorageGb)}
                    className={cn(
                      'mt-6 w-full rounded-md py-3 text-sm font-semibold transition-colors',
                      isHighlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'border border-white/[0.10] text-mk-t2 hover:border-white/20 hover:text-white',
                    )}
                  >
                    Choose {plan.name}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-xl border border-white/[0.06] bg-mk-bg p-5 text-center">
            <p className="text-sm text-mk-t3">
              All plans include: dynamic watermarking, RBAC, complete audit trail, office document preview,
              Google Drive &amp; OneDrive import, download policy control, and compliance reports.
            </p>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="bg-mk-bg py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="text-2xl font-bold text-mk-text">Calculate your monthly cost.</h2>
              <p className="mt-3 text-mk-t2">
                Choose a plan, enter your storage requirement, and see the exact monthly billing — including
                18% GST — before you sign up.
              </p>
              <p className="mt-4 text-sm text-mk-t3">
                Need more than 50 GB or custom terms?{' '}
                <Link href="/contact" className="text-blue-400 hover:text-blue-300">
                  Talk to us
                </Link>
                .
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-mk-s1 p-6">
              <PricingCalculator onChoosePlan={goToSignup} />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ snippet */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-8 text-xl font-bold text-mk-text">Pricing questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'Is there a free trial?',
                a: 'Yes. Create an account and run your first data room before committing to a paid plan. No credit card required to start.',
              },
              {
                q: 'Does pricing include all features?',
                a: 'Yes. Watermarking, RBAC, audit trail, office preview, and cloud import are included on every plan — there is no feature gating by plan tier.',
              },
              {
                q: 'How does storage billing work?',
                a: 'You pay per GB per month at your plan\'s rate, subject to a minimum monthly commitment. GST (18%) is added on top. Storage across all your data rooms is counted together.',
              },
              {
                q: 'Can I change my plan or storage later?',
                a: 'Yes. You can upgrade, downgrade, or adjust your storage at any time. Changes take effect from the next billing cycle.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-white/[0.06] pb-6 last:border-0">
                <dt className="text-sm font-semibold text-mk-text">{q}</dt>
                <dd className="mt-2 text-sm text-mk-t3">{a}</dd>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/faq"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Read all FAQs →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
