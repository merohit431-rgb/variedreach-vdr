'use client';

import { useEffect, useState } from 'react';
import { isPreviewable, isOfficeConvertible } from '@variedreach-vdr/shared';
import { fetchFileBlob, downloadFile, resolveDownloadFilename, FileRecord } from '@/hooks/use-files';
import { extractErrorMessage } from '@/lib/error-message';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'webp'];

// Renders 0/1/2 download actions depending on what the room's download
// policy + the viewer's role actually allow (see availableDownloadFormats).
function DownloadButtons({
  dataRoomId,
  file,
  availableDownloadFormats,
  className,
}: {
  dataRoomId: string;
  file: FileRecord;
  availableDownloadFormats: ('original' | 'watermarked')[];
  className: string;
}) {
  if (availableDownloadFormats.length === 1) {
    const format = availableDownloadFormats[0];
    return (
      <button
        onClick={() => downloadFile(dataRoomId, file.id, resolveDownloadFilename(file, format), undefined, format)}
        className={className}
      >
        Download
      </button>
    );
  }

  if (availableDownloadFormats.length === 2) {
    return (
      <>
        <button onClick={() => downloadFile(dataRoomId, file.id, file.name, undefined, 'original')} className={className}>
          Download Original
        </button>
        <button
          onClick={() =>
            downloadFile(dataRoomId, file.id, resolveDownloadFilename(file, 'watermarked'), undefined, 'watermarked')
          }
          className={className}
        >
          Download Watermarked
        </button>
      </>
    );
  }

  return null;
}

export function FilePreviewModal({
  dataRoomId,
  file,
  availableDownloadFormats = [],
  onClose,
}: {
  dataRoomId: string;
  file: FileRecord;
  availableDownloadFormats?: ('original' | 'watermarked')[];
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

        if (file.extension.toLowerCase() === 'txt') {
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
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
          <div className="flex items-center gap-3">
            <DownloadButtons
              dataRoomId={dataRoomId}
              file={file}
              availableDownloadFormats={availableDownloadFormats}
              className="text-sm text-slate-600 hover:text-slate-900"
            />
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {!previewable && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <p>Preview isn&apos;t available for this file type.</p>
              <DownloadButtons
                dataRoomId={dataRoomId}
                file={file}
                availableDownloadFormats={availableDownloadFormats}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              />
            </div>
          )}

          {previewable && isLoading && <p className="text-sm text-slate-400">Loading preview…</p>}
          {previewable && error && <p className="text-sm text-red-600">{error}</p>}

          {previewable &&
            !isLoading &&
            !error &&
            (file.extension.toLowerCase() === 'pdf' || isOfficeConvertible(file.extension)) &&
            objectUrl && (
              <iframe src={objectUrl} title={file.name} className="h-[75vh] w-full rounded-md border-0" />
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
            <pre className="whitespace-pre-wrap rounded-md bg-white p-4 text-xs text-slate-800">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
