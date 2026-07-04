'use client';

import { useEffect, useRef, useState, DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Upload, FolderPlus } from 'lucide-react';
import { useFiles, useUpdateFile, useDeleteFile, downloadFile, FileRecord } from '@/hooks/use-files';
import { getPreviewFilename } from '@variedreach-vdr/shared';
import { useCreateFolder } from '@/hooks/use-folders';
import { formatBytes, truncateFilename } from '@/lib/format';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Tooltip } from '@/components/ui/Tooltip';
import { useUploadStore } from '@/store/upload-store';
import { UploadProgressPanel } from './UploadProgressPanel';
import { FilePreviewModal } from './FilePreviewModal';
import { VersionHistoryModal } from './VersionHistoryModal';

const DESKTOP_NAME_MAX_LENGTH = 23;
const MOBILE_NAME_MAX_LENGTH = 16;

interface BrowserFileWithPath extends File {
  webkitRelativePath: string;
}

const READY_ITEM_DISPLAY_MS = 1500;

export function FileBrowser({
  dataRoomId,
  folderId,
  search,
  canUpload,
  canDelete,
  canDownload,
}: {
  dataRoomId: string;
  folderId: string | null;
  search: string;
  canUpload: boolean;
  canDelete: boolean;
  canDownload: boolean;
}) {
  const { data: files, isLoading } = useFiles(dataRoomId, { folderId, search });
  const updateFile = useUpdateFile(dataRoomId);
  const deleteFile = useDeleteFile(dataRoomId);
  const createFolder = useCreateFolder(dataRoomId);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const nameMaxLength = isMobile ? MOBILE_NAME_MAX_LENGTH : DESKTOP_NAME_MAX_LENGTH;
  const queryClient = useQueryClient();
  const { items: uploadItems, enqueue } = useUploadStore();

  const multiInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileRecord | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // Items the inline panel has finished showing -- hidden here only, not
  // removed from the global store, so the sticky upload manager (which can
  // outlive this component) keeps a full history regardless of which
  // folder the user was looking at when an upload finished.
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());

  const visibleUploadItems = uploadItems.filter(
    (item) => item.dataRoomId === dataRoomId && item.folderId === folderId && !locallyDismissedIds.has(item.id),
  );
  const hasActiveUploads = visibleUploadItems.some(
    (item) => item.status === 'queued' || item.status === 'uploading' || item.status === 'processing',
  );

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', 'true');
      folderInputRef.current.setAttribute('directory', 'true');
    }
  }, []);

  // Once a file finishes uploading, let it sit briefly with a "Completed"
  // checkmark before folding into the real file list below.
  useEffect(() => {
    const readyItems = visibleUploadItems.filter((item) => item.status === 'ready');
    if (readyItems.length === 0) return;

    const timers = readyItems.map((item) =>
      setTimeout(() => {
        setLocallyDismissedIds((prev) => new Set(prev).add(item.id));
      }, READY_ITEM_DISPLAY_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleUploadItems.map((item) => `${item.id}:${item.status}`).join(',')]);

  function uploadFileList(fileList: FileList | File[]) {
    const list = Array.from(fileList) as BrowserFileWithPath[];
    if (list.length === 0) return;

    for (const file of list) {
      enqueue({
        dataRoomId,
        folderId,
        file,
        relativePath: file.webkitRelativePath || file.name,
        queryClient,
      });
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files.length > 0) {
      uploadFileList(event.dataTransfer.files);
    }
  }

  function handleRename(file: FileRecord) {
    const name = window.prompt('Rename file', file.name);
    if (name && name !== file.name) updateFile.mutate({ fileId: file.id, name });
  }

  function handleDelete(file: FileRecord) {
    if (window.confirm(`Delete "${file.name}"?`)) {
      deleteFile.mutate(file.id);
    }
  }

  function handleCreateFolder() {
    const name = window.prompt('New folder name');
    if (name) createFolder.mutate({ name, parentId: folderId ?? undefined });
  }

  return (
    <div
      onDragOver={(e) => {
        if (canUpload) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={canUpload ? handleDrop : undefined}
      className={`rounded-lg ${isDragOver ? 'ring-2 ring-slate-400' : ''}`}
    >
      {canUpload && (
        <div className="mb-3 flex gap-2">
          <input
            ref={multiInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFileList(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFileList(e.target.files)}
          />
          <button
            onClick={() => multiInputRef.current?.click()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Upload files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Upload folder
          </button>
        </div>
      )}

      <UploadProgressPanel items={visibleUploadItems} />

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading files…</p>
      ) : (!files || files.length === 0) && !hasActiveUploads ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 p-12 text-center">
          <FolderOpen className="h-10 w-10 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-600">This folder is empty</p>
          {canUpload ? (
            <>
              <p className="mt-1 text-sm text-slate-400">Drag &amp; drop files here, or use the buttons below.</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => multiInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Upload files
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  New folder
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">No files have been added to this folder yet.</p>
          )}
        </div>
      ) : !files || files.length === 0 ? null : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="w-24 px-4 py-3">Size</th>
                <th className="w-36 px-4 py-3">Modified</th>
                <th className="w-56 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {files.map((file) => (
                <tr
                  key={file.id}
                  draggable={canUpload}
                  onDragStart={(e) => e.dataTransfer.setData('text/file-id', file.id)}
                  className="hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Tooltip label={file.name} side="top">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="truncate font-medium text-slate-900 hover:underline"
                      >
                        {truncateFilename(file.name, nameMaxLength)}
                      </button>
                    </Tooltip>
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatBytes(file.sizeBytes)}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      {canDownload && (
                        <button
                          onClick={() => downloadFile(dataRoomId, file.id, getPreviewFilename(file.name, file.extension))}
                          className="text-slate-500 hover:text-slate-900"
                        >
                          Download
                        </button>
                      )}
                      <button
                        onClick={() => setVersionsFile(file)}
                        className="text-slate-500 hover:text-slate-900"
                      >
                        Versions
                      </button>
                      {canUpload && (
                        <button
                          onClick={() => handleRename(file)}
                          className="text-slate-500 hover:text-slate-900"
                        >
                          Rename
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(file)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          dataRoomId={dataRoomId}
          file={previewFile}
          canDownload={canDownload}
          onClose={() => setPreviewFile(null)}
        />
      )}
      {versionsFile && (
        <VersionHistoryModal
          dataRoomId={dataRoomId}
          file={versionsFile}
          canManage={canUpload}
          canDownload={canDownload}
          onClose={() => setVersionsFile(null)}
        />
      )}
    </div>
  );
}
