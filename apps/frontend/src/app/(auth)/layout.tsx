import { ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 p-10 lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden="true"
        />
        <Logo size="lg" showSubtitle variant="light" className="relative" />
        <div className="relative max-w-sm space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            Built for IBC insolvency professionals
          </div>
          <p className="text-2xl font-semibold leading-snug text-white">
            A secure, auditable data room for every stage of resolution.
          </p>
          <p className="text-sm text-white/70">
            Trusted by resolution professionals, lenders, and legal teams to manage diligence with
            full visibility and control.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Varied Reach. All rights reserved.</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 text-center lg:hidden">
            <Logo size="lg" showSubtitle className="justify-center" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-card">{children}</div>
        </div>
      </div>
    </main>
  );
}
