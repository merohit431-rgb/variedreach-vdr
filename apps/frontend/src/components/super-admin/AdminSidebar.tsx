'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  CreditCard,
  RefreshCcw,
  FileText,
  TrendingUp,
  Activity,
  ScrollText,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/super-admin/dashboard',      label: 'Overview',        icon: LayoutDashboard },
  { href: '/super-admin/organisations',  label: 'Organisations',   icon: Building2 },
  { href: '/super-admin/registrations',  label: 'Registrations',   icon: UserPlus },
  { href: '/super-admin/payments',       label: 'Payments',        icon: CreditCard },
  { href: '/super-admin/subscriptions',  label: 'Subscriptions',   icon: RefreshCcw },
  { href: '/super-admin/invoices',       label: 'Invoices',        icon: FileText },
  { href: '/super-admin/revenue',        label: 'Revenue',         icon: TrendingUp },
  { href: '/super-admin/health',         label: 'Platform Health', icon: Activity },
  { href: '/super-admin/activity',       label: 'Activity Log',    icon: ScrollText },
];

interface AdminSidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AdminSidebar({ isMobileOpen, onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();

  const content = (
    <>
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-600">
            <ShieldAlert className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Admin Portal</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">VariedReach VDR</p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200',
              )}
            >
              <item.icon className="h-[17px] w-[17px] flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition-colors"
        >
          ← Back to App
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden h-screen w-60 flex-shrink-0 flex-col bg-slate-900 lg:flex">
        {content}
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 animate-fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-60 flex-col bg-slate-900 shadow-2xl animate-slide-up">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
