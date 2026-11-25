'use client';

import { useEffect, useState } from 'react';
import { isPreviewable, isOfficeConvertible, isTextPreviewable, IMAGE_EXTENSIONS, getPreviewFilename } from '@variedreach-vdr/shared';
import { fetchFileBlob, downloadFile, useArchiveListing, FileRecord } from '@/hooks/use-files';
import { extractErrorMessage } from '@/lib/error-message';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

// Phase 3D: "ZIP/7Z/RAR: File metadata and archive listing only where
// safely supported" -- ZIP is the one with a safe listing path (see
// archive.service.ts); this renders it, never an extraction UI.
function ArchiveListingPanel({ dataRoomId, fileId }: { dataRoomId: string; fileId: string }) {
  const { data: listing, isLoading, error } = useArchiveListing(dataRoomId, fileId, true);

  if (isLoading) return <p className="text-sm text-app-t3">Reading archive contents…</p>;
  if (error) return <p className="text-sm text-red-400">{extractErrorMessage(error)}</p>;
  if (!listing) return null;

  return (
    <div className="text-sm">
      {listing.suspiciousTotalSize && (
        <p className="mb-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          ⚠ This archive&apos;s declared uncompressed size is unusually large relative to its compressed size.
        </p>
      )}
      {listing.truncated && (
        <p className="mb-2 text-xs text-app-t3">
          Showing the first {listing.entries.length} of {listing.totalEntries} entries.
        </p>
      )}
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-app-border text-app-t3">
            <th className="py-1.5 font-medium">Name</th>
            <th className="py-1.5 font-medium">Size</th>
          </tr>
        </thead>
        <tbody>
          {listing.entries.map((entry) => (
            <tr key={entry.name} className="border-b border-app-border/50">
              <td className="truncate py-1.5 pr-2 text-app-text">
                {entry.name}
                {entry.suspiciousPath && <span className="ml-1.5 text-amber-500" title="Unusual stored path">⚠</span>}
                {entry.suspiciouslyHighRatio && (
                  <span className="ml-1.5 text-amber-500" title="Unusually high compression ratio">⚠</span>
                )}
                {entry.isEncrypted && <span className="ml-1.5 text-app-t3" title="Encrypted entry">🔒</span>}
              </td>
              <td className="whitespace-nowrap py-1.5 text-app-t3">
                {entry.isDirectory ? '—' : formatBytes(entry.uncompressedSizeBytes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilePreviewModal({
  dataRoomId,
  file,
  canDownload = true,
  initialPage,
  onClose,
}: {
  dataRoomId: string;
  file: FileRecord;
  canDownload?: boolean;
  // Jumps the browser's native PDF viewer to this page via a URL fragment
  // on the same authorised blob URL below -- not a different fetch, not a
  // different endpoint, so this never bypasses watermarking/NDA/folder
  // permissions to get there.
  initialPage?: number;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const previewable = isPreviewable(file.extension);

  useEffect(() => {
    if (!previewable) {
      setIsLoading(false);
      return;
    }

    let url: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const blob = await fetchFileBlob(`/data-rooms/${dataRoomId}/files/${file.id}/preview`);
        if (cancelled) return;

        if (isTextPreviewable(file.extension)) {
          setTextContent(await blob.text());
        } else {
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [dataRoomId, file.id, file.extension, previewable]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-app-s1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <p className="truncate text-sm font-medium text-app-text">{file.name}</p>
          <div className="flex items-center gap-3">
            {canDownload && (
              <button
                onClick={() => downloadFile(dataRoomId, file.id, getPreviewFilename(file.name, file.extension))}
                className="text-sm text-app-t2 hover:text-app-text"
              >
                Download
              </button>
            )}
            <button onClick={onClose} className="text-app-t3 hover:text-app-t2" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-app-s2 p-4">
          {file.extension.toLowerCase() === 'zip' && <ArchiveListingPanel dataRoomId={dataRoomId} fileId={file.id} />}

          {file.extension.toLowerCase() !== 'zip' && !previewable && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-app-t3">
              <p>Preview isn&apos;t available for this file type.</p>
              {canDownload && (
                <button
                  onClick={() => downloadFile(dataRoomId, file.id, getPreviewFilename(file.name, file.extension))}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Download to view
                </button>
              )}
            </div>
          )}

          {previewable && isLoading && <p className="text-sm text-app-t3">Loading preview…</p>}
          {previewable && error && <p className="text-sm text-red-400">{error}</p>}

          {previewable &&
            !isLoading &&
            !error &&
            (file.extension.toLowerCase() === 'pdf' || isOfficeConvertible(file.extension)) &&
            objectUrl && (
              <iframe
                src={initialPage ? `${objectUrl}#page=${initialPage}` : objectUrl}
                title={file.name}
                className="h-[75vh] w-full rounded-md border-0"
              />
            )}

          {previewable &&
            !isLoading &&
            !error &&
            IMAGE_EXTENSIONS.includes(file.extension.toLowerCase()) &&
            objectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={objectUrl} alt={file.name} className="mx-auto max-h-[75vh] object-contain" />
            )}

          {previewable && !isLoading && !error && textContent !== null && (
            <pre className="whitespace-pre-wrap rounded-md bg-app-s1 p-4 text-xs text-app-text">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
