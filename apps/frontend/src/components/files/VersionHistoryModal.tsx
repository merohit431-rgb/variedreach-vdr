'use client';

import { useRef, useState } from 'react';
import { getPreviewFilename } from '@variedreach-vdr/shared';
import { useFileVersions, useAddFileVersion, downloadFile, FileRecord } from '@/hooks/use-files';
import { formatBytes } from '@/lib/format';
import { extractErrorMessage } from '@/lib/error-message';

export function VersionHistoryModal({
  dataRoomId,
  file,
  canManage,
  canDownload = true,
  onClose,
}: {
  dataRoomId: string;
  file: FileRecord;
  canManage: boolean;
  canDownload?: boolean;
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
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-app-s1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <p className="truncate text-sm font-medium text-app-text">Version history — {file.name}</p>
          <button onClick={onClose} className="text-app-t3 hover:text-app-t2" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {error && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          {isLoading ? (
            <p className="text-sm text-app-t3">Loading versions…</p>
          ) : (
            <ul className="space-y-2">
              {versions?.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center justify-between rounded-md border border-app-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-app-text">
                      v{version.versionNumber} · {formatBytes(version.sizeBytes)}
                    </p>
                    <p className="text-xs text-app-t3">
                      {version.comment} · {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {canDownload && (
                    <button
                      onClick={() =>
                        downloadFile(dataRoomId, file.id, getPreviewFilename(file.name, file.extension), version.id)
                      }
                      className="text-xs text-app-t2 hover:text-app-text"
                    >
                      Download
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage && (
          <div className="border-t border-app-border p-4">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={addVersion.isPending}
              className="w-full rounded-md border border-app-border2 px-3 py-2 text-sm font-medium text-app-t2 hover:bg-app-s2 disabled:opacity-50"
            >
              {addVersion.isPending ? 'Uploading...' : 'Upload new version'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
