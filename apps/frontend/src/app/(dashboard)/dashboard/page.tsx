'use client';

import { useDashboardStats, useRecentActivity } from '@/hooks/use-dashboard';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StorageWidget } from '@/components/dashboard/StorageWidget';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      {statsLoading || !stats ? (
        <p className="text-sm text-slate-400">Loading stats…</p>
      ) : (
        <>
          <StatsCards stats={stats} />
          <StorageWidget storage={stats.storage} />
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickActions />
        {activityLoading || !activity ? (
          <p className="text-sm text-slate-400">Loading activity…</p>
        ) : (
          <RecentActivity items={activity} />
        )}
      </div>
    </div>
  );
}
