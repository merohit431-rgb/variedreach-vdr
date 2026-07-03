'use client';

import { UploadItem } from '@/store/upload-store';
import { UploadRow } from './UploadRow';

export function UploadProgressPanel({ items }: { items: UploadItem[] }) {
  if (items.length === 0) return null;

  const finishedCount = items.filter((item) => item.status === 'ready').length;
  const overallPercent =
    items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + (item.status === 'ready' ? 100 : item.progressPercent), 0) / items.length)
      : 0;

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-app-border bg-app-s1">
      {items.length > 1 && (
        <div className="border-b border-app-border bg-app-s2 px-4 py-2 text-xs font-medium text-app-t2">
          Uploading {finishedCount} of {items.length} files — {overallPercent}% complete
        </div>
      )}
      <div className="divide-y divide-app-border">
        {items.map((item) => (
          <UploadRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
