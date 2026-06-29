'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { EnvironmentBanner } from '@/components/layout/EnvironmentBanner';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHomeContent } from '@/components/marketing/MarketingHomeContent';

export default function Home() {
  const router = useRouter();
  const { user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing || !user) return;
    router.replace('/dashboard');
  }, [isInitializing, user, router]);

  if (isInitializing || user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EnvironmentBanner />
      <MarketingNav />
      <main className="flex-1">
        <MarketingHomeContent />
      </main>
      <MarketingFooter />
    </div>
  );
}
