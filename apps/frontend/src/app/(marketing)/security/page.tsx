import { Stamp, KeyRound, History, Lock, ShieldAlert, Eye, Shield, Server, FileText } from 'lucide-react';
import Link from 'next/link';

const SECURITY_PILLARS = [
  {
    icon: Stamp,
    title: 'Dynamic per-download watermarking',
    description:
      "Every PDF download and office document preview is watermarked in real time with the viewer's full name, email address, and a timestamp. The watermark is applied server-side — it cannot be bypassed, removed, or opted out of. If a document is leaked, the source is immediately identifiable.",
  },
  {
    icon: KeyRound,
    title: 'Granular role-based access control',
    description:
      'Eight distinct roles — Org Admin, Resolution Professional, Liquidator, CoC Member, Auditor, Legal Advisor, Resolution Applicant, Guest — each scoped to precisely the documents and actions that role requires. No role can escalate its own privileges.',
  },
  {
    icon: Eye,
    title: 'Configurable download policy',
    description:
      'Each data room has a configurable download policy: preview only, original download, watermarked download, or both. The policy is applied consistently to every user in the room, and can be updated at any time as deal conditions change.',
  },
  {
    icon: ShieldAlert,
    title: 'External-role hard floor',
    description:
      "External roles — Resolution Applicants, Guests, Legal Advisors — can never receive unwatermarked original documents, regardless of the room's download policy setting. This is a system-level protection, not an admin option.",
  },
  {
    icon: History,
    title: 'Tamper-evident audit trail',
    description:
      'Every view, download, upload, permission change, and invitation is logged immutably with actor, action, resource, timestamp, and IP address. The audit trail cannot be modified or selectively deleted. It is fully exportable for courts and regulators.',
  },
  {
    icon: Lock,
    title: 'AES-256 encryption at rest, TLS in transit',
    description:
      'All files stored in Varied Reach are encrypted at rest using AES-256. All traffic between users and the platform is served exclusively over TLS 1.3. There is no plaintext storage of document content.',
  },
  {
    icon: Shield,
    title: 'Short-lived authenticated sessions',
    description:
      'Access tokens are short-lived and rotated via refresh tokens stored in HttpOnly cookies. Session management follows OWASP guidelines. Tokens are not stored in localStorage or accessible via JavaScript.',
  },
  {
    icon: Server,
    title: 'Zero untracked downloads',
    description:
      'There is no pathway to download a document without generating an audit event. Preview, download, watermarked, or original — every access is logged. There are no debug modes, admin bypasses, or bulk-export tools that skip logging.',
  },
  {
    icon: FileText,
    title: 'Office document preview without download',
    description:
      'Word, Excel, and PowerPoint files are converted server-side and served as secure, watermarked previews. Users can review the full document without receiving the source file — reducing exposure surface for sensitive materials.',
  },
];

const ARCHITECTURE_LAYERS = [
  { label: 'Browser', detail: 'TLS 1.3 encrypted connection. Short-lived tokens. HttpOnly cookies.' },
  { label: 'CDN / Reverse Proxy', detail: 'Nginx reverse proxy. Rate limiting. Request validation.' },
  { label: 'Application API', detail: 'NestJS. JWT authentication. Role guards on every endpoint.' },
  { label: 'File Processing', detail: 'Server-side watermarking. Office conversion. Magic byte validation.' },
  { label: 'Database', detail: 'PostgreSQL. Encrypted credentials. Audit log append-only writes.' },
  { label: 'File Storage', detail: 'AES-256 at rest. Per-file encryption keys. No public URLs.' },
];

export default function SecurityPage() {
  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Security Architecture
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            Built around the principle that access must always be traceable.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            Confidential documents should only ever reach people authorised to see them. And every access —
            every view, every download — must be provable, permanently, to any level of scrutiny.
          </p>
        </div>
      </section>

      {/* Security pillars */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Security principles
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_PILLARS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-mk-bg p-6 transition-colors hover:border-blue-500/20"
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

      {/* Architecture */}
      <section className="bg-mk-bg py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Platform architecture
          </h2>
          <p className="mb-10 text-mk-t2">
            Security controls are enforced at every layer — not just at the application boundary.
          </p>
          <div className="space-y-3">
            {ARCHITECTURE_LAYERS.map((layer, i) => (
              <div key={layer.label} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-600">
                    {i + 1}
                  </div>
                  {i < ARCHITECTURE_LAYERS.length - 1 && (
                    <div className="mt-1 h-6 w-px bg-slate-100" aria-hidden="true" />
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-mk-s1 px-5 py-4 flex-1 -mt-0.5">
                  <p className="text-sm font-semibold text-mk-text">{layer.label}</p>
                  <p className="mt-0.5 text-xs text-mk-t3">{layer.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-mk-text">Questions about our security posture?</h2>
          <p className="mt-3 text-mk-t2">
            We are happy to discuss our architecture, answer security questionnaires, or walk through our
            controls with your IT or legal team.
          </p>
          <div className="mt-6">
            <Link
              href="/contact"
              className="inline-flex rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
