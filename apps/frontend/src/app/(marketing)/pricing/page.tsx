'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLAN_IDS, PRICING_PLANS, type PlanId } from '@variedreach-vdr/shared';
import { PricingCalculator } from '@/components/marketing/PricingCalculator';
import { PlanCard } from '@/components/marketing/PlanCard';
import { cn } from '@/lib/cn';

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
          <span className="inline-block rounded-full border border-blue-600/25 bg-blue-600/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700">
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

      {/* Plan cards — rendered from the shared PRICING_PLANS constant */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {PLAN_IDS.map((id) => {
              const plan = PRICING_PLANS[id];
              const isHighlighted = id === 'PROFESSIONAL';
              return (
                <PlanCard
                  key={id}
                  planId={id}
                  highlighted={isHighlighted}
                  cta={
                    <div>
                      <button
                        onClick={() => goToSignup(id, plan.minimumStorageGb)}
                        className={cn(
                          'w-full rounded-md py-3 text-sm font-semibold transition-colors',
                          isHighlighted
                            ? 'bg-slate-900 text-white hover:bg-slate-700'
                            : 'border border-slate-300 text-mk-t2 hover:border-slate-400 hover:text-slate-900',
                        )}
                      >
                        Choose {plan.name}
                      </button>
                      <Link
                        href="/book-demo"
                        className="mt-2.5 block text-center text-xs font-medium text-mk-t3 transition-colors hover:text-slate-900"
                      >
                        or book a live demo first →
                      </Link>
                    </div>
                  }
                />
              );
            })}
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-mk-bg p-5 text-center">
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
                <Link href="/contact" className="text-blue-700 hover:text-blue-800">
                  Talk to us
                </Link>
                .
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-mk-s1 p-6">
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
                a: 'No — and that is deliberate. Instead of an empty trial account, we run a guided start: book a live demo, see the platform against your own use case, and be live with a working data room within a day of signing up.',
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
              <div key={q} className="border-b border-slate-200 pb-6 last:border-0">
                <dt className="text-sm font-semibold text-mk-text">{q}</dt>
                <dd className="mt-2 text-sm text-mk-t3">{a}</dd>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/faq" className="text-sm font-medium text-blue-700 hover:text-blue-800">
              Read all FAQs →
            </Link>
            <Link href="/book-demo" className="text-sm font-medium text-blue-700 hover:text-blue-800">
              Book a live demo →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
