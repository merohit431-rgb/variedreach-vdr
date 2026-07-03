'use client';

import { X, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import { useUploadStore, UploadItem } from '@/store/upload-store';
import { getFileIcon } from '@/lib/file-icon';
import { formatBytes, formatSpeed, formatEta } from '@/lib/format';

export const UPLOAD_STATUS_LABEL: Record<UploadItem['status'], string> = {
  queued: 'Queued',
  uploading: 'Uploading…',
  processing: 'Processing…',
  ready: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
};

export function UploadRow({ item }: { item: UploadItem }) {
  const { cancel, retry, remove } = useUploadStore();
  const Icon = getFileIcon(item.file.name.split('.').pop() ?? '');
  const isActive = item.status === 'queued' || item.status === 'uploading' || item.status === 'processing';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="h-5 w-5 flex-shrink-0 text-app-t3" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-app-text">{item.file.name}</p>
          <span className="flex-shrink-0 text-xs text-app-t3">{formatBytes(item.file.size)}</span>
        </div>

        {isActive ? (
          <div className="mt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-s2">
              <div
                className="h-full rounded-full bg-app-primary transition-all"
                style={{ width: `${item.status === 'processing' ? 100 : item.progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-app-t3">
              <span>{UPLOAD_STATUS_LABEL[item.status]}</span>
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
                ? 'text-red-400'
                : item.status === 'ready'
                  ? 'text-emerald-400'
                  : 'text-app-t3'
            }`}
          >
            {item.status === 'ready' && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
            {item.status === 'failed' && <XCircle className="h-3 w-3" aria-hidden="true" />}
            {item.status === 'failed' && item.error ? item.error : UPLOAD_STATUS_LABEL[item.status]}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {isActive && (
          <button onClick={() => cancel(item.id)} title="Cancel" className="text-app-t3 hover:text-app-t2">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {item.status === 'failed' && (
          <button onClick={() => retry(item.id)} title="Retry" className="text-app-t3 hover:text-app-t2">
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {(item.status === 'failed' || item.status === 'canceled') && (
          <button onClick={() => remove(item.id)} title="Dismiss" className="text-app-t3 hover:text-app-t2">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
