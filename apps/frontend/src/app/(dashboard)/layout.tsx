'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { EnvironmentBanner } from '@/components/layout/EnvironmentBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isInitializing } = useAuth();
  const { isCollapsed, toggle } = useSidebarCollapsed();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isInitializing && !user) {
      router.replace('/login');
    }
  }, [isInitializing, user, router]);

  if (isInitializing || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <EnvironmentBanner />
      <div className="flex flex-1">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={toggle}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />
        <div className="flex flex-1 flex-col">
          <TopNav onOpenMobileMenu={() => setIsMobileOpen(true)} />
          <main className="flex-1 animate-fade-in p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
