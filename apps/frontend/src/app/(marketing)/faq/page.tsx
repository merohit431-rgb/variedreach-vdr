'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const FAQS = [
  {
    category: 'Platform & Security',
    items: [
      {
        q: 'Is Varied Reach VDR compliant with IBC 2016 requirements for CIRP proceedings?',
        a: 'Yes. The platform is designed specifically for IBC proceedings. The audit trail, role-based access (RP, CoC, Resolution Applicant), and watermarked document sharing align with IBBI regulations and NCLT submission requirements.',
      },
      {
        q: 'How does dynamic watermarking work in practice?',
        a: "When a user downloads or previews a document, the system applies a watermark in real time containing their name, email address, and timestamp. This happens server-side — users cannot bypass or remove it. Every single download is traced.",
      },
      {
        q: 'Is my data encrypted?',
        a: 'All files are encrypted at rest using AES-256 encryption. All traffic between users and the platform is served exclusively over TLS 1.3. There is no plaintext storage of document content.',
      },
      {
        q: 'Who can access a data room?',
        a: 'Only people explicitly invited to a data room. Each member is assigned one of our eight roles (Org Admin, RP, Liquidator, CoC Member, Auditor, Legal Advisor, Resolution Applicant, Guest) that determines exactly what they can see and do.',
      },
      {
        q: 'Can external stakeholders access documents without creating an Org account?',
        a: 'External users are invited via email and can access their permitted documents through a secure, authenticated session. They do not need to create an organisation account — they log in as invited members of that specific data room.',
      },
    ],
  },
  {
    category: 'Documents & Access',
    items: [
      {
        q: 'Can I export the audit trail for submission to the NCLT or IBBI?',
        a: 'Yes. The audit trail is exportable in full at any time. It includes actor, action, document, timestamp, and IP address — formatted for regulatory or court submission.',
      },
      {
        q: 'What file types can be previewed without downloading?',
        a: 'PDF files are natively previewed in the browser. Word (docx), Excel (xlsx), and PowerPoint (pptx) files are converted and served as secure previews — no desktop application needed. All previews are watermarked.',
      },
      {
        q: 'How large can individual file uploads be?',
        a: 'Individual files can be up to 2 GB each. This accommodates large financial models, engineering documents, legal submissions, and asset schedules.',
      },
      {
        q: 'What happens to data after a CIRP is closed or a deal is completed?',
        a: 'You retain full access to your data room and all documents for the lifetime of your subscription. You can archive the room, export the audit trail, and download all documents before closure.',
      },
    ],
  },
  {
    category: 'Pricing & Billing',
    items: [
      {
        q: 'How is pricing calculated?',
        a: "Pricing is based on the storage you need, billed monthly per GB at your plan's rate, subject to the plan's minimum commitment. The amount shown is the total payable — there are no additional taxes or hidden charges.",
      },
      {
        q: 'Is there a free trial?',
        a: 'No — and that is deliberate. Instead of an empty trial account, we run a guided start: book a live demo, see the platform against your own use case, and be live with a working data room within a day of signing up.',
      },
      {
        q: 'Is there a limit on how many data rooms I can create?',
        a: 'No — every plan includes unlimited data rooms. You can run multiple concurrent CIRP proceedings, M&A transactions, and client engagements simultaneously.',
      },
      {
        q: 'What happens to my documents if a payment is missed?',
        a: "We never delete documents over a billing issue — your data stays intact and safe. If there's ever a payment problem, our support team reaches out directly to help resolve it before anything about your access changes.",
      },
      {
        q: 'Can I change my plan or storage later?',
        a: "Storage increases can be requested anytime from your dashboard and are typically applied the same day. Moving between plan tiers isn't yet self-service — contact our team and we'll handle it directly.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-mk-bg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-mk-text">{q}</span>
        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 flex-shrink-0 text-mk-t3 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p className="border-t border-slate-100 px-5 pb-4 pt-3 text-sm leading-relaxed text-mk-t2">
          {a}
        </p>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="bg-mk-bg">
      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
            FAQ
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-mk-text sm:text-5xl">
            Frequently asked questions.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-mk-t2">
            Questions specific to IBC, CIRP, security, and how Varied Reach works in practice.
          </p>
        </div>
      </section>

      {/* FAQ categories */}
      {FAQS.map((cat, catIdx) => (
        <section
          key={cat.category}
          className={catIdx % 2 === 0 ? 'bg-mk-s1 py-12' : 'bg-mk-bg py-12'}
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-blue-600">
              {cat.category}
            </h2>
            <div className="space-y-2">
              {cat.items.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="bg-mk-s1 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-xl font-bold text-mk-text">Still have questions?</h2>
          <p className="mt-3 text-mk-t2">We typically respond within one business day.</p>
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
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
