import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Contact
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            We typically respond within one business day.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mk-t2">
            Whether you have questions about onboarding, security, pricing, or a specific use case — reach
            out. We are happy to walk through the platform with you.
          </p>
        </div>
      </section>

      {/* Contact grid */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <a
              href="mailto:rohit@variedreach.com"
              className="group flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-mk-bg p-6 transition-colors hover:border-blue-500/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Email</p>
                <p className="mt-1 text-sm font-medium text-mk-text group-hover:text-blue-400 transition-colors">
                  rohit@variedreach.com
                </p>
                <p className="mt-1 text-xs text-mk-t3">For all enquiries</p>
              </div>
            </a>

            <a
              href="tel:+918851096461"
              className="group flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-mk-bg p-6 transition-colors hover:border-blue-500/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Phone className="h-5 w-5 text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Phone</p>
                <p className="mt-1 text-sm font-medium text-mk-text group-hover:text-blue-400 transition-colors">
                  +91 88510 96461
                </p>
                <p className="mt-1 text-xs text-mk-t3">Mon–Fri, 9am–6pm IST</p>
              </div>
            </a>

            <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-mk-bg p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <MapPin className="h-5 w-5 text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-mk-t4">Office</p>
                <p className="mt-1 text-sm font-medium text-mk-text">New Delhi, India</p>
                <p className="mt-1 text-xs text-mk-t3">
                  S Block 376, Panchsheel Park, New Delhi 110017
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Common contact reasons */}
      <section className="bg-mk-bg py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-8 text-xl font-bold text-mk-text">Common reasons to reach out</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Book a live demo',
                desc: 'See the platform in action with a 30-minute walkthrough tailored to your use case.',
              },
              {
                title: 'Security review',
                desc: 'Answer your security questionnaire, share our architecture, or walk through controls with your IT team.',
              },
              {
                title: 'Custom storage or enterprise pricing',
                desc: 'Need more than 50 GB or a custom contract for a large team or high-volume use case.',
              },
              {
                title: 'CIRP or IBC-specific onboarding',
                desc: 'Get help structuring your first data room for an active CIRP proceeding — fast.',
              },
              {
                title: 'Integration questions',
                desc: 'Questions about API access, Google Drive import, OneDrive, or connecting to your existing tools.',
              },
              {
                title: 'General enquiries',
                desc: "Anything else — we're reachable by email and phone during business hours.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/[0.06] bg-mk-s1 p-5"
              >
                <h3 className="text-sm font-semibold text-mk-text">{item.title}</h3>
                <p className="mt-1.5 text-xs text-mk-t3">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="mailto:rohit@variedreach.com"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Send an email
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md border border-white/[0.10] px-6 py-3 text-sm font-semibold text-mk-t2 transition-colors hover:text-white"
            >
              Start free trial instead
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
