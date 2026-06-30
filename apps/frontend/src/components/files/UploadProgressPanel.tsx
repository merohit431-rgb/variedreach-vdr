'use client';

import { X, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import { useUploadStore, UploadItem } from '@/store/upload-store';
import { getFileIcon } from '@/lib/file-icon';
import { formatBytes, formatSpeed, formatEta } from '@/lib/format';

const STATUS_LABEL: Record<UploadItem['status'], string> = {
  queued: 'Queued',
  uploading: 'Uploading…',
  processing: 'Processing…',
  ready: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
};

function UploadRow({ item }: { item: UploadItem }) {
  const { cancel, retry, remove } = useUploadStore();
  const Icon = getFileIcon(item.file.name.split('.').pop() ?? '');
  const isActive = item.status === 'queued' || item.status === 'uploading' || item.status === 'processing';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{item.file.name}</p>
          <span className="flex-shrink-0 text-xs text-slate-400">{formatBytes(item.file.size)}</span>
        </div>

        {isActive ? (
          <div className="mt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${item.status === 'processing' ? 100 : item.progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>{STATUS_LABEL[item.status]}</span>
              {item.status === 'uploading' && (
                <>
                  <span>{item.progressPercent}%</span>
                  {item.speedBytesPerSec > 0 && <span>{formatSpeed(item.speedBytesPerSec)}</span>}
                  {item.etaSeconds !== null && <span>{formatEta(item.etaSeconds)}</span>}
                </>
              )}
            </div>
          </div>
        ) : (
          <p
            className={`mt-1 flex items-center gap-1 text-xs ${
              item.status === 'failed'
                ? 'text-red-600'
                : item.status === 'ready'
                  ? 'text-emerald-600'
                  : 'text-slate-400'
            }`}
          >
            {item.status === 'ready' && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
            {item.status === 'failed' && <XCircle className="h-3 w-3" aria-hidden="true" />}
            {item.status === 'failed' && item.error ? item.error : STATUS_LABEL[item.status]}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {isActive && (
          <button
            onClick={() => cancel(item.id)}
            title="Cancel"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {item.status === 'failed' && (
          <button
            onClick={() => retry(item.id)}
            title="Retry"
            className="text-slate-400 hover:text-slate-700"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {(item.status === 'failed' || item.status === 'canceled') && (
          <button
            onClick={() => remove(item.id)}
            title="Dismiss"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

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
