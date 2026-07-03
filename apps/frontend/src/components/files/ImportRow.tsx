'use client';

import { X, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import { useImportStore, ImportItem } from '@/store/import-store';
import { getFileIcon } from '@/lib/file-icon';
import { formatBytes } from '@/lib/format';

const PROVIDER_LABEL: Record<ImportItem['provider'], string> = {
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
};

const STATUS_LABEL: Record<ImportItem['status'], string> = {
  queued: 'Queued',
  importing: 'Importing…',
  ready: 'Imported',
  failed: 'Failed',
  canceled: 'Canceled',
};

export function ImportRow({ item }: { item: ImportItem }) {
  const { cancel, retry, remove } = useImportStore();
  const ext = item.name.split('.').pop() ?? '';
  const Icon = getFileIcon(ext);
  const isActive = item.status === 'queued' || item.status === 'importing';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="h-5 w-5 flex-shrink-0 text-app-t3" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-app-text">{item.name}</p>
          <span className="flex-shrink-0 text-xs text-app-t3">{formatBytes(item.sizeBytes)}</span>
        </div>

        {isActive ? (
          <div className="mt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-s2">
              <div
                className={`h-full rounded-full transition-all ${
                  item.status === 'importing'
                    ? 'w-full animate-pulse bg-app-primary'
                    : 'w-0 bg-app-primary'
                }`}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-app-t3">
              <span>{STATUS_LABEL[item.status]}</span>
              <span className="text-app-t4">·</span>
              <span>{PROVIDER_LABEL[item.provider]}</span>
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
            {item.status === 'failed' && item.error ? item.error : STATUS_LABEL[item.status]}
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {isActive && (
          <button
            onClick={() => cancel(item.id)}
            title="Cancel"
            className="text-app-t3 hover:text-app-t2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {item.status === 'failed' && (
          <button
            onClick={() => retry(item.id)}
            title="Retry"
            className="text-app-t3 hover:text-app-t2"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {(item.status === 'failed' || item.status === 'canceled') && (
          <button
            onClick={() => remove(item.id)}
            title="Dismiss"
            className="text-app-t3 hover:text-app-t2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
