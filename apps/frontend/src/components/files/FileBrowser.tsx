'use client';

import { useEffect, useRef, useState, DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFiles, useUpdateFile, useDeleteFile, downloadFile, FileRecord } from '@/hooks/use-files';
import { getPreviewFilename } from '@variedreach-vdr/shared';
import { formatBytes } from '@/lib/format';
import { useUploadStore } from '@/store/upload-store';
import { UploadProgressPanel } from './UploadProgressPanel';
import { FilePreviewModal } from './FilePreviewModal';
import { VersionHistoryModal } from './VersionHistoryModal';

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
  const queryClient = useQueryClient();
  const { items: uploadItems, enqueue, remove: removeUploadItem } = useUploadStore();

  const multiInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileRecord | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const visibleUploadItems = uploadItems.filter(
    (item) => item.dataRoomId === dataRoomId && item.folderId === folderId,
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
  // checkmark before folding into the real file list below -- removing it
  // immediately would make the row just vanish with no confirmation.
  useEffect(() => {
    const readyItems = visibleUploadItems.filter((item) => item.status === 'ready');
    if (readyItems.length === 0) return;

    const timers = readyItems.map((item) =>
      setTimeout(() => removeUploadItem(item.id), READY_ITEM_DISPLAY_MS),
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
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          {canUpload ? 'No files yet — drag files here or use Upload.' : 'No files yet.'}
        </div>
      ) : !files || files.length === 0 ? null : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Modified</th>
                <th className="px-4 py-3" />
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
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="truncate font-medium text-slate-900 hover:underline"
                    >
                      {file.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(file.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-600">
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
