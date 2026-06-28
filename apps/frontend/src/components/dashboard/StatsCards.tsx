import { DashboardStats } from '@/hooks/use-dashboard';

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: 'Active Data Rooms', value: stats.activeDataRooms },
    { label: 'Total Users', value: stats.totalUsers },
    { label: 'Storage Used', value: `${stats.storage.usedGb} GB` },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
