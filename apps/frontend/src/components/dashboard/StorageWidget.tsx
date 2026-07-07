'use client';

import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { DashboardStorage } from '@/hooks/use-dashboard';
import { getStorageLevel, STORAGE_LEVEL_STYLES, type StorageLevel } from '@/lib/storage-status';
import { StorageUpgradeDialog } from '@/components/dashboard/StorageUpgradeDialog';
import { cn } from '@/lib/cn';

const LEVEL_COPY: Record<StorageLevel, string | null> = {
  ok: null,
  warning: 'Storage running low — consider archiving inactive rooms or upgrading your plan.',
  critical: 'Storage almost full — upgrade soon to avoid interruptions.',
  full: 'Storage is full. New uploads are blocked until you free up space or upgrade.',
};

export function StorageWidget({ storage }: { storage: DashboardStorage }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const level = getStorageLevel(storage.percentUsed);
  const styles = STORAGE_LEVEL_STYLES[level];
  const showAction = level !== 'ok';

  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">Storage</p>
        <HardDrive className="h-4 w-4 text-app-t4" aria-hidden="true" />
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-xl font-bold tracking-tight text-app-text">{storage.usedGb} GB</p>
        <p className={cn('text-xs font-medium', showAction ? styles.text : 'text-app-t3')}>
          {storage.percentUsed}% of {storage.limitGb} GB
        </p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-app-s2">
        <div
          className={cn('h-full rounded-full transition-all', showAction ? styles.bar : 'bg-emerald-500')}
          style={{ width: `${Math.min(storage.percentUsed, 100)}%` }}
        />
      </div>

      {LEVEL_COPY[level] && <p className={cn('mt-2.5 text-xs', styles.text)}>{LEVEL_COPY[level]}</p>}

      {showAction && (
        <button
          type="button"
          onClick={() => setShowUpgrade(true)}
          className="mt-3 w-full rounded-lg border border-app-border2 bg-app-s2 py-2 text-xs font-semibold text-app-t2 transition-colors hover:border-app-primary hover:text-app-primary"
        >
          Need more storage?
        </button>
      )}

      <StorageUpgradeDialog open={showUpgrade} onClose={() => setShowUpgrade(false)} currentGb={storage.limitGb} />
    </div>
  );
}
