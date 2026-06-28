import { DashboardStats } from '@/hooks/use-dashboard';

export function StorageWidget({ storage }: { storage: DashboardStats['storage'] }) {
  const barColor =
    storage.percentUsed >= 95 ? 'bg-red-500' : storage.percentUsed >= 80 ? 'bg-amber-500' : 'bg-slate-900';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-700">Storage</p>
        <p className="text-sm text-slate-500">
          {storage.usedGb} GB / {storage.limitGb} GB
        </p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${storage.percentUsed}%` }}
        />
      </div>
      {storage.percentUsed >= 80 && (
        <p className="mt-2 text-xs text-amber-600">
          {storage.percentUsed}% of storage used — consider archiving old data rooms.
        </p>
      )}
    </div>
  );
}
