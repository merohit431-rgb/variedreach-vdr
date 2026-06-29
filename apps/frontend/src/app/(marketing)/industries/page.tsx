import { Gavel, Building2, Handshake, Users, TrendingUp, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

const INDUSTRIES = [
  {
    icon: Gavel,
    title: 'IBC & CIRP',
    description:
      'Share resolution plans, claims, and committee materials with Resolution Professionals, the Committee of Creditors, and prospective resolution applicants — all within one auditable room.',
  },
  {
    icon: Scale,
    title: 'Liquidation',
    description: 'Coordinate asset documentation and stakeholder communication for liquidation proceedings with full traceability.',
  },
  {
    icon: Handshake,
    title: 'M&A due diligence',
    description: 'Run buy-side and sell-side diligence with watermarked previews, structured folders, and per-party access control.',
  },
  {
    icon: Users,
    title: 'Board meetings',
    description: 'Distribute board packs and resolutions to directors with controlled, traceable access.',
  },
  {
    icon: TrendingUp,
    title: 'Fundraising',
    description: 'Share financials and cap tables with prospective investors without losing control of the underlying documents.',
  },
  {
    icon: Building2,
    title: 'Legal document sharing',
    description: 'Collaborate with external counsel and advisors on sensitive legal documents with role-scoped visibility.',
  },
];

export default function IndustriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Industries we serve</h1>
        <p className="mt-3 text-lg text-slate-600">
          Varied Reach was built first for insolvency professionals, and extends naturally to any transaction
          that needs structured, auditable document sharing.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardContent>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                <Icon className="h-5 w-5 text-brand-700" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
