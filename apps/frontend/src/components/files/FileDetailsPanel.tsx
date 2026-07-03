'use client';

import { X, Download, Eye, Pencil, Trash2, History } from 'lucide-react';
import { FileRecord, downloadFile } from '@/hooks/use-files';
import { getPreviewFilename } from '@variedreach-vdr/shared';
import { formatBytes } from '@/lib/format';
import { getFileIcon } from '@/lib/file-icon';

interface FileDetailsPanelProps {
  dataRoomId: string;
  file: FileRecord;
  canDownload: boolean;
  canUpload: boolean;
  canDelete: boolean;
  onClose: () => void;
  onPreview: () => void;
  onVersions: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function FileDetailsPanel({
  dataRoomId,
  file,
  canDownload,
  canUpload,
  canDelete,
  onClose,
  onPreview,
  onVersions,
  onRename,
  onDelete,
}: FileDetailsPanelProps) {
  const Icon = getFileIcon(file.extension);

  return (
    <div className="w-64 flex-shrink-0 self-start rounded-lg border border-app-border bg-app-s1">
      <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
        <p className="text-sm font-medium text-app-text">Details</p>
        <button onClick={onClose} className="text-app-t3 hover:text-app-t2" aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="mb-4 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-app-s2">
            <Icon className="h-7 w-7 text-app-t3" aria-hidden="true" />
          </div>
          <p className="break-all text-center text-sm font-medium text-app-text">{file.name}</p>
          <span className="rounded bg-app-s2 px-2 py-0.5 font-mono text-xs uppercase text-app-t2">
            {file.extension || 'file'}
          </span>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="flex-shrink-0 text-app-t3">Size</dt>
            <dd className="truncate text-right font-medium text-app-text">{formatBytes(file.sizeBytes)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="flex-shrink-0 text-app-t3">Modified</dt>
            <dd className="text-right font-medium text-app-text">
              {new Date(file.updatedAt).toLocaleDateString()}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="flex-shrink-0 text-app-t3">Uploaded by</dt>
            <dd className="max-w-[120px] truncate text-right font-medium text-app-text">{file.uploadedBy}</dd>
          </div>
          {file.currentVersion && (
            <div className="flex justify-between gap-2">
              <dt className="flex-shrink-0 text-app-t3">Version</dt>
              <dd className="text-right font-medium text-app-text">v{file.currentVersion.versionNumber}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 space-y-1.5 border-t border-app-border pt-4">
          <button
            onClick={onPreview}
            className="flex w-full items-center gap-2 rounded-md border border-app-border px-3 py-2 text-sm text-app-t2 hover:bg-app-s2"
          >
            <Eye className="h-4 w-4 text-app-t3" aria-hidden="true" /> Preview
          </button>
          {canDownload && (
            <button
              onClick={() =>
                downloadFile(dataRoomId, file.id, getPreviewFilename(file.name, file.extension))
              }
              className="flex w-full items-center gap-2 rounded-md border border-app-border px-3 py-2 text-sm text-app-t2 hover:bg-app-s2"
            >
              <Download className="h-4 w-4 text-app-t3" aria-hidden="true" /> Download
            </button>
          )}
          <button
            onClick={onVersions}
            className="flex w-full items-center gap-2 rounded-md border border-app-border px-3 py-2 text-sm text-app-t2 hover:bg-app-s2"
          >
            <History className="h-4 w-4 text-app-t3" aria-hidden="true" /> Version history
          </button>
          {canUpload && (
            <button
              onClick={onRename}
              className="flex w-full items-center gap-2 rounded-md border border-app-border px-3 py-2 text-sm text-app-t2 hover:bg-app-s2"
            >
              <Pencil className="h-4 w-4 text-app-t3" aria-hidden="true" /> Rename
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
