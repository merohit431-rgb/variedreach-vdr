import { Stamp, KeyRound, History, Eye, FileStack, Lock, CloudUpload, BarChart3, FolderTree, HardDrive, Check } from 'lucide-react';
import Link from 'next/link';

const FEATURE_CATEGORIES = [
  {
    category: 'Access & Security',
    features: [
      {
        icon: KeyRound,
        title: 'Eight-level role-based access control',
        description:
          'Org Admin, Resolution Professional, Liquidator, CoC Member, Auditor, Legal Advisor, Resolution Applicant, and Guest — each role scoped to exactly the documents and actions that role requires. Access is assigned per person, per data room.',
      },
      {
        icon: Stamp,
        title: 'Dynamic per-download watermarking',
        description:
          "Every PDF download and office document preview is watermarked in real time with the recipient's name, email address, and timestamp. Leaks are always traceable. External roles cannot receive unwatermarked originals — this is a hard floor, not a setting.",
      },
      {
        icon: Lock,
        title: 'Configurable download policy',
        description:
          'Each data room has its own download policy: preview only, original downloads, watermarked downloads, or both. The policy applies to every user in the room consistently and can be changed at any time without re-inviting members.',
      },
    ],
  },
  {
    category: 'Document Management',
    features: [
      {
        icon: FolderTree,
        title: 'Structured folder hierarchy',
        description:
          'Organise documents into nested folder trees — Financials, Legal, Claims, Resolution Plans, and more. Drag-and-drop upload, bulk folder upload, and cloud import from Google Drive and OneDrive are all supported.',
      },
      {
        icon: FileStack,
        title: 'Document version history',
        description:
          'Upload new versions of a document without losing the prior version. Every version is accessible to authorised users, and the audit trail tracks which version was viewed or downloaded by whom.',
      },
      {
        icon: HardDrive,
        title: 'Large file support (up to 2 GB)',
        description:
          'Individual files up to 2 GB can be uploaded in a single request. Financial models, engineering drawings, legal submissions — handled without compression or chunking workarounds.',
      },
    ],
  },
  {
    category: 'Visibility & Compliance',
    features: [
      {
        icon: History,
        title: 'Tamper-evident audit trail',
        description:
          'Every view, download, upload, permission change, and member invitation is logged immutably with actor, action, resource, timestamp, and IP. The audit trail is exportable in full for regulatory submission, NCLT filings, or board review.',
      },
      {
        icon: Eye,
        title: 'In-browser office preview',
        description:
          'Word (docx), Excel (xlsx), and PowerPoint (pptx) files are converted and served as secure previews directly in the browser. Stakeholders can review documents without downloading them — and previews are watermarked too.',
      },
      {
        icon: BarChart3,
        title: 'Reports & analytics',
        description:
          'Generate document access reports, user activity summaries, download logs, and storage utilisation breakdowns. Exportable as structured data for compliance or deal reporting.',
      },
    ],
  },
  {
    category: 'Integrations',
    features: [
      {
        icon: CloudUpload,
        title: 'Google Drive import',
        description:
          'Connect Google Drive via OAuth and select files or folders to import directly into a data room. Access token is persisted for repeat imports. Imported files are processed through the full VDR pipeline: watermarking, RBAC, and audit trail.',
      },
      {
        icon: CloudUpload,
        title: 'Microsoft OneDrive import',
        description:
          'Import from OneDrive with the same one-click OAuth flow. Select individual files or entire folders. The VDR applies access control and watermarking immediately post-import.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Platform Features
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            Every feature built for security, not convenience.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            Each capability in Varied Reach VDR exists because the alternative — email, shared drives, generic
            cloud — creates risks that high-stakes transactions cannot afford.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book-demo"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Book a live demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-mk-t2 transition-colors hover:text-slate-900"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Feature categories */}
      {FEATURE_CATEGORIES.map((cat, catIdx) => (
        <section
          key={cat.category}
          className={catIdx % 2 === 0 ? 'bg-mk-s1 py-16' : 'bg-mk-bg py-16'}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="mb-10 text-xs font-semibold uppercase tracking-widest text-blue-600">
              {cat.category}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cat.features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 bg-mk-s2 p-6 transition-colors hover:border-blue-500/20"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-mk-text">{title}</h3>
                  <p className="text-sm leading-relaxed text-mk-t3">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Included in every plan */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-mk-text">All features included in every plan.</h2>
          <p className="mt-3 text-mk-t2">
            No feature gating. Watermarking, RBAC, audit trail, office preview, cloud import, and reports are
            available on every Varied Reach plan.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {[
              'Dynamic watermarking',
              'Role-based access',
              'Audit trail',
              'Office preview',
              'Cloud import',
              'Download policy',
              'Version history',
              'Reports',
            ].map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-sm text-mk-t2">
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                {f}
              </span>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/book-demo"
              className="inline-flex rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Book a live demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
