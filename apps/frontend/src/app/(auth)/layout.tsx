import { ShieldCheck, Stamp, KeyRound, History, Share2, Lock } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { EnvironmentBanner } from '@/components/layout/EnvironmentBanner';

const ENTERPRISE_FEATURES = [
  { icon: ShieldCheck, label: 'Enterprise-grade security' },
  { icon: Stamp, label: 'Dynamic document watermarking' },
  { icon: KeyRound, label: 'Granular role-based permissions' },
  { icon: History, label: 'Complete audit trail' },
  { icon: Share2, label: 'Secure document sharing' },
  { icon: Lock, label: '24×7 encrypted access' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <EnvironmentBanner />
      <main className="flex flex-1">
        <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 p-10 lg:flex">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden="true"
          />
          <Logo size="xl" showSubtitle variant="light" className="relative" />
          <div className="relative max-w-sm space-y-6">
            <p className="text-2xl font-semibold leading-snug text-white">
              Secure document collaboration for every critical transaction.
            </p>
            <ul className="space-y-3">
              {ENTERPRISE_FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/20">
                    <Icon className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Varied Reach. All rights reserved.</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md animate-slide-up">
            <div className="mb-8 text-center lg:hidden">
              <Logo size="xl" showSubtitle className="justify-center" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-card">{children}</div>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Protected by enterprise-grade encryption
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
