import { FolderLock, Users, HardDrive } from 'lucide-react';
import { DashboardStats } from '@/hooks/use-dashboard';
import { StatCard } from '@/components/dashboard/StatCard';

export function StatsCards({ stats }: { stats: DashboardStats }) {
  if ('activeDataRooms' in stats) {
    const storageIconColor = stats.storage.percentUsed >= 80 ? 'text-amber-400' : 'text-emerald-400';
    const storageIconBg = stats.storage.percentUsed >= 80 ? 'bg-amber-500/10' : 'bg-emerald-500/10';

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active Data Rooms"
          value={stats.activeDataRooms}
          icon={FolderLock}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          description="Currently open for review"
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          description="Members across all rooms"
        />
        <StatCard
          label="Storage Used"
          value={`${stats.storage.usedGb} GB`}
          icon={HardDrive}
          iconColor={storageIconColor}
          iconBg={storageIconBg}
          description={`of ${stats.storage.limitGb} GB — ${stats.storage.percentUsed}% used`}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard
        label="Your Assignments"
        value={stats.assignedDataRooms}
        icon={FolderLock}
        iconColor="text-blue-400"
        iconBg="bg-blue-500/10"
        description="Data rooms you have access to"
      />
    </div>
  );
}
