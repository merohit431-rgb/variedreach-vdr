import { FolderLock, Users, HardDrive } from 'lucide-react';
import { DashboardStats } from '@/hooks/use-dashboard';
import { StatCard } from '@/components/dashboard/StatCard';

export function StatsCards({ stats }: { stats: DashboardStats }) {
  if ('activeDataRooms' in stats) {
    const storageIconColor = stats.storage.percentUsed >= 80 ? 'text-amber-600' : 'text-emerald-600';
    const storageIconBg = stats.storage.percentUsed >= 80 ? 'bg-amber-50' : 'bg-emerald-50';

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active Data Rooms"
          value={stats.activeDataRooms}
          icon={FolderLock}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Currently open for review"
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
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
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
        description="Data rooms you have access to"
      />
    </div>
  );
}
