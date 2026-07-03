import Link from 'next/link';

const INDUSTRIES = [
  {
    id: 'cirp',
    emoji: '⚖️',
    title: 'IBC & CIRP',
    subtitle: 'Insolvency and Bankruptcy Code proceedings',
    description:
      'Share resolution plans, claims registers, Committee of Creditors (CoC) materials, and hearing documents with RPs, CoC members, prospective Resolution Applicants, and legal advisors — each with role-scoped access and a complete audit trail.',
    keyUses: [
      'Watermarked document sharing with Resolution Applicants',
      'CoC member access with role segregation',
      'Audit trail exportable for NCLT submission',
      'IBC-aligned role structure (RP, CoC, RA, Auditor)',
    ],
  },
  {
    id: 'liquidation',
    emoji: '🏛️',
    title: 'Liquidation',
    subtitle: 'Court-appointed and voluntary liquidation',
    description:
      'Manage asset documentation, creditor communication, and statutory filings for liquidation proceedings. Give liquidators, creditors, and their legal teams access to exactly the documents they need — traceable, watermarked, and audit-logged throughout.',
    keyUses: [
      'Asset schedules shared with bidders (watermarked)',
      'Creditor communication with access tracking',
      'Statutory reports with per-document access logs',
      'Liquidator as super-admin of the data room',
    ],
  },
  {
    id: 'ma',
    emoji: '🤝',
    title: 'M&A Due Diligence',
    subtitle: 'Buy-side and sell-side transactions',
    description:
      'Run buy-side and sell-side diligence with watermarked previews, structured folder trees, and per-party access control. Invite multiple bidder groups simultaneously without cross-contamination.',
    keyUses: [
      'Separate data rooms per bidder group',
      'Watermarked previews of all financial documents',
      'Q&A log and management presentation access',
      'Deal close audit trail for board reporting',
    ],
  },
  {
    id: 'pe',
    emoji: '📈',
    title: 'Private Equity & VC',
    subtitle: 'Investment committee and portfolio management',
    description:
      'Share investment memos, due diligence reports, financial models, and portfolio data with IC members, LPs, and co-investors — with download controls that prevent uncontrolled distribution of sensitive materials.',
    keyUses: [
      'Investment committee document rooms',
      'LP reporting with restricted access',
      'Co-investor onboarding with role assignment',
      'Portfolio company data rooms',
    ],
  },
  {
    id: 'banking',
    emoji: '🏦',
    title: 'Banking & NBFC',
    subtitle: 'Loan syndication and restructuring',
    description:
      'Coordinate loan syndication, restructuring documentation, and regulatory submission workflows. Segregate access across consortium banks, external advisors, and regulatory reviewers with full traceability.',
    keyUses: [
      'Consortium lender access management',
      'Regulatory submission with audit evidence',
      'Restructuring negotiation document rooms',
      'Credit appraisal document sharing',
    ],
  },
  {
    id: 'legal',
    emoji: '📋',
    title: 'Law Firms & Legal Advisors',
    subtitle: 'Client matter document exchange',
    description:
      'Create matter-specific data rooms for each client engagement. Share privileged documents with clients, opposing counsel (where appropriate), and courts — with watermarks, access logs, and download controls protecting confidentiality at every step.',
    keyUses: [
      'Client matter document rooms',
      'External counsel access with restrictions',
      'Privileged document sharing with audit trail',
      'Court-submissible access evidence',
    ],
  },
  {
    id: 'homebuyers',
    emoji: '🏠',
    title: 'Homebuyer Committees',
    subtitle: 'IBC Section 7A representation',
    description:
      'Section 7A homebuyer financial creditors are represented in CoC proceedings alongside banks and financial institutions. Varied Reach enables homebuyer committee representatives to securely access and review CIRP documents at scale.',
    keyUses: [
      'Homebuyer representative access (CoC role)',
      'Document access without unwatermarked downloads',
      'Audit trail for representative accountability',
      'IBC-compliant role and access structure',
    ],
  },
  {
    id: 'realestate',
    emoji: '🏗️',
    title: 'Real Estate & Infrastructure',
    subtitle: 'Project data rooms for complex deals',
    description:
      'Share environmental reports, project plans, approvals, and financial models with lenders, investors, and regulatory bodies — with version tracking and audit trails that satisfy due diligence requirements.',
    keyUses: [
      'Project data rooms for lenders and investors',
      'Regulatory submission document management',
      'Contractor and consultant access control',
      'Version tracking for project documents',
    ],
  },
  {
    id: 'stressed',
    emoji: '🔄',
    title: 'Stressed Asset Resolution',
    subtitle: 'ARC and IBA-led processes',
    description:
      'Asset Reconstruction Companies and IBA-led stressed asset resolution processes require structured document exchange with multiple parties under strict confidentiality. Varied Reach provides the access control and audit infrastructure this requires.',
    keyUses: [
      'Multi-party access with role segregation',
      'Watermarked document sharing with acquirers',
      'Audit trail for regulatory accountability',
      'Confidentiality agreement compliance evidence',
    ],
  },
  {
    id: 'forensic',
    emoji: '🔍',
    title: 'Forensic & Advisory',
    subtitle: 'Investigation and advisory engagements',
    description:
      'Forensic investigations, fraud reviews, and advisory engagements require complete, tamper-evident access records. Varied Reach generates court-admissible evidence of who accessed what, when, and from where.',
    keyUses: [
      'Tamper-evident document access evidence',
      'Forensic reviewer access with full logging',
      'Export-grade audit trail for court submissions',
      'Watermarked document sharing with restricted parties',
    ],
  },
];

export default function IndustriesPage() {
  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Industries
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            Built for every high-stakes Indian transaction.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            Varied Reach was built first for IBC and CIRP proceedings, and extends naturally to any
            transaction where document security, access control, and audit traceability are non-negotiable.
          </p>
        </div>
      </section>

      {/* Industry cards */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <div
                key={ind.id}
                id={ind.id}
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-mk-bg p-7 transition-colors hover:border-blue-500/20"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 text-2xl">{ind.emoji}</div>
                    <h2 className="text-lg font-bold text-mk-text">{ind.title}</h2>
                    <p className="text-xs text-mk-t4">{ind.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-mk-t2">{ind.description}</p>
                <ul className="mt-5 space-y-2">
                  {ind.keyUses.map((use) => (
                    <li key={use} className="flex items-start gap-2 text-xs text-mk-t3">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500/50" />
                      {use}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-mk-bg py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-mk-text">
            Don&apos;t see your use case?
          </h2>
          <p className="mt-3 text-mk-t2">
            If you need structured, auditable, watermarked document sharing with role-based access — Varied
            Reach covers it. Talk to us and we&apos;ll walk through how it maps to your workflow.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/book-demo"
              className="inline-flex rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Book a live demo
            </Link>
            <Link
              href="/contact"
              className="inline-flex rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-mk-t2 transition-colors hover:text-slate-900"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
