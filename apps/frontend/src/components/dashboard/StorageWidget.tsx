import { HardDrive } from 'lucide-react';
import { DashboardStorage } from '@/hooks/use-dashboard';
import { cn } from '@/lib/cn';

export function StorageWidget({ storage }: { storage: DashboardStorage }) {
  const isCritical = storage.percentUsed >= 95;
  const isWarning = storage.percentUsed >= 80;

  const barColor = isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-brand-500';
  const labelColor = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Storage</p>
        <HardDrive className="h-4 w-4 text-slate-300" aria-hidden="true" />
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-xl font-bold tracking-tight text-slate-900">{storage.usedGb} GB</p>
        <p className={cn('text-xs font-medium', labelColor)}>
          {storage.percentUsed}% of {storage.limitGb} GB
        </p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(storage.percentUsed, 100)}%` }}
        />
      </div>

      {(isCritical || isWarning) && (
        <p className={cn('mt-2.5 text-xs', labelColor)}>
          {isCritical
            ? 'Storage almost full — archive old data rooms to free up space.'
            : 'Storage running low — consider archiving inactive rooms.'}
        </p>
      )}
    </div>
  );
}
