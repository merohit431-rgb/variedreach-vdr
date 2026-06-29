import Link from 'next/link';
import { ShieldCheck, Stamp, KeyRound, History, Share2, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const ENTERPRISE_FEATURES = [
  { icon: ShieldCheck, label: 'Enterprise-grade security' },
  { icon: Stamp, label: 'Dynamic document watermarking' },
  { icon: KeyRound, label: 'Granular role-based permissions' },
  { icon: History, label: 'Complete audit trail' },
  { icon: Share2, label: 'Secure document sharing' },
  { icon: Lock, label: '24×7 encrypted access' },
];

const USE_CASES = [
  {
    title: 'Insolvency & CIRP',
    description: 'Share resolution plans, claims, and committee documents with RPs, CoC members, and bidders.',
  },
  {
    title: 'Liquidation',
    description: 'Manage asset documentation and stakeholder communication through a single, auditable room.',
  },
  {
    title: 'M&A Due Diligence',
    description: 'Run buy-side and sell-side diligence with watermarked previews and per-room access control.',
  },
];

export function MarketingHomeContent() {
  return (
    <>
      <section className="relative overflow-hidden bg-slate-50">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,23,42,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Secure document collaboration for every critical transaction.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              Varied Reach is a virtual data room built for insolvency professionals, liquidators, and deal teams
              who need watermarked sharing, granular access control, and a complete audit trail — without
              compromising on security.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pricing">
                <Button size="lg">
                  View pricing
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="lg" variant="secondary">
                  Create account
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {ENTERPRISE_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-soft">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <Icon className="h-4 w-4 text-brand-700" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-slate-700">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Built for high-stakes document sharing</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every data room is structured around clear roles, traceable access, and downloads that protect the
          source document.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <Card key={useCase.title}>
              <CardContent>
                <h3 className="font-semibold text-slate-900">{useCase.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{useCase.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/industries" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            See all industries we serve →
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900">Ready to set up your data room?</h2>
          <p className="mt-2 text-slate-600">Choose a plan and get started in minutes.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/pricing">
              <Button size="lg">View pricing</Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="secondary">
                Talk to us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
