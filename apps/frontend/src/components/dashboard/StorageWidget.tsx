import { HardDrive } from 'lucide-react';
import { DashboardStorage } from '@/hooks/use-dashboard';
import { cn } from '@/lib/cn';

export function StorageWidget({ storage }: { storage: DashboardStorage }) {
  const isCritical = storage.percentUsed >= 95;
  const isWarning = storage.percentUsed >= 80;

  const barColor = isCritical ? 'bg-red-500/100' : isWarning ? 'bg-amber-500/100' : 'bg-app-primary';
  const labelColor = isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-app-t3';

  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">Storage</p>
        <HardDrive className="h-4 w-4 text-app-t4" aria-hidden="true" />
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-xl font-bold tracking-tight text-app-text">{storage.usedGb} GB</p>
        <p className={cn('text-xs font-medium', labelColor)}>
          {storage.percentUsed}% of {storage.limitGb} GB
        </p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-app-s2">
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
