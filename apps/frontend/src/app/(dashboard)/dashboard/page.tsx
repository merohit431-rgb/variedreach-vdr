'use client';

import { useDashboardStats, useRecentActivity } from '@/hooks/use-dashboard';
import { useAuthStore } from '@/store/auth-store';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StatCardSkeleton } from '@/components/dashboard/StatCard';
import { StorageWidget } from '@/components/dashboard/StorageWidget';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Skeleton } from '@/components/ui/Skeleton';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useRecentActivity(12);

  const isAdminView = stats && 'activeDataRooms' in stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-app-text">
          {getGreeting()}{user ? `, ${user.firstName}` : ''}.
        </h1>
        <p className="mt-0.5 text-sm text-app-t3">{formatDate()}</p>
      </div>

      {/* Stat cards */}
      {statsLoading || !stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <StatsCards stats={stats} />
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity feed — takes 2/3 */}
        <div className="lg:col-span-2">
          {activityLoading || !activity ? (
            <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
              <Skeleton className="h-3.5 w-32" />
              <div className="mt-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                    </div>
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <RecentActivity items={activity} />
          )}
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-4">
          <QuickActions />
          {isAdminView && stats && 'storage' in stats && (
            <StorageWidget storage={stats.storage} />
          )}
        </div>
      </div>
    </div>
  );
}
