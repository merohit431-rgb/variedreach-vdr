import { MapPin, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
            About
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            Built by people who ran CIRP proceedings.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-mk-t2">
            Varied Reach is a virtual data room company based in New Delhi, India. We build secure document
            sharing infrastructure for insolvency professionals, deal teams, and any organisation that needs to
            prove who saw what.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold text-mk-text">Why we built this</h2>
              <div className="mt-5 space-y-4 text-mk-t2 leading-relaxed">
                <p>
                  The platform grew out of direct experience managing document workflows for CIRP and
                  liquidation proceedings under the Insolvency and Bankruptcy Code — situations where access
                  control, watermarking, and audit trails are not optional extras. They are the difference
                  between a clean process and a disputed one.
                </p>
                <p>
                  Existing tools — email, Dropbox, Google Drive — were not built for this. No watermarking, no
                  role segregation for RPs and CoC members, no legal-grade audit trail. Every CIRP proceeding
                  that used generic tools was leaving itself exposed.
                </p>
                <p>
                  We built Varied Reach to fix that. The same rigour that CIRP proceedings require now extends
                  to M&amp;A due diligence, banking, private equity, real estate, and any high-stakes Indian
                  enterprise transaction.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="text-xl font-bold text-mk-text">Our principles</h2>
              {[
                {
                  title: 'Security is not a feature',
                  desc: 'Watermarking, audit trails, and role-based access are foundational — not add-ons.',
                },
                {
                  title: 'Compliance built in',
                  desc: 'IBC-aligned roles, NCLT-exportable audit trails, and IBBI-compatible workflows by default.',
                },
                {
                  title: 'Simplicity under the hood',
                  desc: 'Powerful security controls that do not require your team to become security experts to use correctly.',
                },
                {
                  title: 'Indian enterprise, first',
                  desc: 'Built for the regulatory, legal, and workflow realities of Indian transactions — not retrofitted from Western markets.',
                },
              ].map((p) => (
                <div
                  key={p.title}
                  className="rounded-xl border border-slate-200 bg-mk-bg px-5 py-4"
                >
                  <p className="text-sm font-semibold text-mk-text">{p.title}</p>
                  <p className="mt-1 text-sm text-mk-t3">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-mk-bg py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-8 text-xl font-bold text-mk-text">Get in touch</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <a
              href="mailto:support@variedreach.com"
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-mk-s1 px-5 py-4 transition-colors hover:border-blue-500/20"
            >
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Email</p>
                <p className="mt-1 text-sm text-mk-t2">support@variedreach.com</p>
              </div>
            </a>
            <a
              href="tel:+918851096461"
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-mk-s1 px-5 py-4 transition-colors hover:border-blue-500/20"
            >
              <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Phone</p>
                <p className="mt-1 text-sm text-mk-t2">+91 88510 96461</p>
              </div>
            </a>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-mk-s1 px-5 py-4">
              <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Office</p>
                <p className="mt-1 text-sm text-mk-t2">
                  S Block 376, Panchsheel Park, New Delhi 110017
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/contact"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Go to contact page →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
