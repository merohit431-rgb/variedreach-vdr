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
    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {items.length > 1 && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
          Uploading {finishedCount} of {items.length} files — {overallPercent}% complete
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <UploadRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
