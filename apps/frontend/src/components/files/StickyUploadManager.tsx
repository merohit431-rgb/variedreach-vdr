'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useUploadStore } from '@/store/upload-store';
import { UploadRow } from './UploadRow';

export function StickyUploadManager() {
  const { items, clearFinished } = useUploadStore();
  const [isMinimized, setIsMinimized] = useState(false);

  if (items.length === 0) return null;

  const completedCount = items.filter((item) => item.status === 'ready').length;
  const uploadingCount = items.filter(
    (item) => item.status === 'queued' || item.status === 'uploading' || item.status === 'processing',
  ).length;
  const failedCount = items.filter((item) => item.status === 'failed').length;
  const hasFinished = items.some((item) => ['ready', 'failed', 'canceled'].includes(item.status));

  // "Clear completed" only clears finished items across every data room the
  // user has uploaded to this session -- clearFinished is scoped per room,
  // so sweep every room that actually appears in the current item list.
  function handleClearFinished() {
    const dataRoomIds = new Set(items.map((item) => item.dataRoomId));
    dataRoomIds.forEach((id) => clearFinished(id));
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <button
        onClick={() => setIsMinimized((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-left text-white"
      >
        <span className="text-sm font-medium">Uploads ({items.length})</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {completedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                {completedCount}
              </span>
            )}
            {uploadingCount > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" aria-hidden="true" />
                {uploadingCount}
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
            {items.map((item) => (
              <UploadRow key={item.id} item={item} />
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
