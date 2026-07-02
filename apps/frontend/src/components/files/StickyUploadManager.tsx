'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useUploadStore } from '@/store/upload-store';
import { useImportStore } from '@/store/import-store';
import { UploadRow } from './UploadRow';
import { ImportRow } from './ImportRow';

export function StickyUploadManager() {
  const { items: uploadItems, clearFinished: clearUploadFinished } = useUploadStore();
  const { items: importItems, clearFinished: clearImportFinished } = useImportStore();
  const [isMinimized, setIsMinimized] = useState(false);

  const totalCount = uploadItems.length + importItems.length;
  if (totalCount === 0) return null;

  const completedCount =
    uploadItems.filter((i) => i.status === 'ready').length +
    importItems.filter((i) => i.status === 'ready').length;
  const activeCount =
    uploadItems.filter((i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'processing').length +
    importItems.filter((i) => i.status === 'queued' || i.status === 'importing').length;
  const failedCount =
    uploadItems.filter((i) => i.status === 'failed').length +
    importItems.filter((i) => i.status === 'failed').length;
  const hasFinished =
    uploadItems.some((i) => ['ready', 'failed', 'canceled'].includes(i.status)) ||
    importItems.some((i) => ['ready', 'failed', 'canceled'].includes(i.status));

  function handleClearFinished() {
    const uploadRoomIds = new Set(uploadItems.map((i) => i.dataRoomId));
    uploadRoomIds.forEach((id) => clearUploadFinished(id));
    const importRoomIds = new Set(importItems.map((i) => i.dataRoomId));
    importRoomIds.forEach((id) => clearImportFinished(id));
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <button
        onClick={() => setIsMinimized((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-left text-white"
      >
        <span className="text-sm font-medium">Transfers ({totalCount})</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {completedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                {completedCount}
              </span>
            )}
            {activeCount > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" aria-hidden="true" />
                {activeCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                {failedCount}
              </span>
            )}
          </div>
          {isMinimized ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {!isMinimized && (
        <>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {uploadItems.map((item) => (
              <UploadRow key={item.id} item={item} />
            ))}
            {importItems.map((item) => (
              <ImportRow key={item.id} item={item} />
            ))}
          </div>
          {hasFinished && (
            <button
              onClick={handleClearFinished}
              className="w-full border-t border-slate-100 px-4 py-2 text-center text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            >
              Clear completed
            </button>
          )}
        </>
      )}
    </div>
  );
}
