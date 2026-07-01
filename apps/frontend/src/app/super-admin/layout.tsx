'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, ShieldAlert, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { AdminSidebar } from '@/components/super-admin/AdminSidebar';
import { Avatar } from '@/components/ui/Avatar';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isInitializing, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!isInitializing) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'SUPER_ADMIN') {
        router.replace('/dashboard');
      }
    }
  }, [isInitializing, user, router]);

  if (isInitializing || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="flex flex-1 flex-col">
        {/* Admin TopNav */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Super Admin
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen((p) => !p)}
              className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-slate-50"
            >
              <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
              <span className="hidden text-slate-700 sm:inline">{user.firstName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg z-50">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-medium text-slate-900">{user.firstName} {user.lastName}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <button
                  onClick={() => { setIsUserMenuOpen(false); logout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
