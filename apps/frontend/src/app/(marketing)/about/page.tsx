import { MapPin } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">About Varied Reach</h1>

      <div className="mt-6 space-y-4 text-slate-600">
        <p>
          Varied Reach builds secure virtual data room software for insolvency professionals, liquidators, and
          deal teams who need to share confidential documents with the right people — and prove who saw what.
        </p>
        <p>
          The platform grew out of direct experience running document workflows for CIRP and liquidation
          proceedings under the IBC, where access control, watermarking, and audit trails aren&apos;t optional
          extras — they&apos;re the difference between a clean process and a disputed one. That same rigor now
          extends to M&amp;A due diligence, board communication, and any transaction that depends on controlled
          document sharing.
        </p>
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-900">Registered office</p>
          <p className="mt-1 text-sm text-slate-600">S Block, 376, Block S, Panchsheel Park, New Delhi 110017</p>
        </div>
      </div>
    </div>
  );
}
