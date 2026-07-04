'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { EnvironmentBanner } from '@/components/layout/EnvironmentBanner';
import { StickyUploadManager } from '@/components/files/StickyUploadManager';
import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardShell>{children}</DashboardShell>
    </ThemeProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isInitializing } = useAuth();
  const { isCollapsed, toggle } = useSidebarCollapsed();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    if (!isInitializing) {
      if (!user) {
        router.replace('/login');
      } else if (user.role === 'SUPER_ADMIN') {
        router.replace('/super-admin/dashboard');
      }
    }
  }, [isInitializing, user, router]);

  if (isInitializing || !user || user.role === 'SUPER_ADMIN') {
    return (
      <div
        className={`app-${theme} flex min-h-screen items-center justify-center bg-app-bg text-sm text-app-t3`}
      >
        Loading…
      </div>
    );
  }

  return (
    <div className={`app-${theme} flex min-h-screen flex-col bg-app-bg text-app-text`}>
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
      <StickyUploadManager />
    </div>
  );
}
