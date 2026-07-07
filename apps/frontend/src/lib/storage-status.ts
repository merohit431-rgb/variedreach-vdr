export type StorageLevel = 'ok' | 'warning' | 'critical' | 'full';

// Thresholds: green under 85%, amber 85-94%, red 95%+, full at 100% (blocks
// uploads). Shared by every place that renders organisation storage usage so
// the "traffic light" semantics stay consistent across the app.
export function getStorageLevel(percent: number): StorageLevel {
  if (percent >= 100) return 'full';
  if (percent >= 95) return 'critical';
  if (percent >= 85) return 'warning';
  return 'ok';
}

export const STORAGE_LEVEL_STYLES: Record<StorageLevel, { bar: string; text: string }> = {
  ok: { bar: 'bg-emerald-500', text: 'text-emerald-500' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-500' },
  critical: { bar: 'bg-red-500', text: 'text-red-500' },
  full: { bar: 'bg-red-500', text: 'text-red-500' },
};
