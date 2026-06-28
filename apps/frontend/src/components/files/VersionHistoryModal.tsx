'use client';

import { useRef, useState } from 'react';
import { useFileVersions, useAddFileVersion, downloadFile, FileRecord } from '@/hooks/use-files';
import { formatBytes } from '@/lib/format';
import { extractErrorMessage } from '@/lib/error-message';

export function VersionHistoryModal({
  dataRoomId,
  file,
  canManage,
  onClose,
}: {
  dataRoomId: string;
  file: FileRecord;
  canManage: boolean;
  onClose: () => void;
}) {
  const { data: versions, isLoading } = useFileVersions(dataRoomId, file.id);
  const addVersion = useAddFileVersion(dataRoomId, file.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;

    setError(null);
    try {
      await addVersion.mutateAsync({ file: selected });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-900">Version history — {file.name}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading versions…</p>
          ) : (
            <ul className="space-y-2">
              {versions?.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      v{version.versionNumber} · {formatBytes(version.sizeBytes)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {version.comment} · {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadFile(dataRoomId, file.id, file.name, version.id)}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage && (
          <div className="border-t border-slate-200 p-4">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={addVersion.isPending}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {addVersion.isPending ? 'Uploading...' : 'Upload new version'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
