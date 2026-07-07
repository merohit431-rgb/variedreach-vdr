'use client';

import { useEffect, useMemo, useRef, useState, DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Upload, FolderPlus, Grid3X3, List, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Cloud, Download, History, PenLine, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import {
  useFiles,
  useUpdateFile,
  useDeleteFile,
  downloadFile,
  bulkDownloadFiles,
  FileRecord,
} from '@/hooks/use-files';
import { getPreviewFilename } from '@variedreach-vdr/shared';
import { useCreateFolder } from '@/hooks/use-folders';
import { formatBytes, truncateFilename } from '@/lib/format';
import { extractErrorMessage } from '@/lib/error-message';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Tooltip } from '@/components/ui/Tooltip';
import { useUploadStore } from '@/store/upload-store';
import { useImportStore, ImportProvider } from '@/store/import-store';
import { getFileIcon } from '@/lib/file-icon';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { StorageUpgradeDialog } from '@/components/dashboard/StorageUpgradeDialog';
import { UploadProgressPanel } from './UploadProgressPanel';
import { ImportProgressPanel } from './ImportProgressPanel';
import { CloudImportModal } from './CloudImportModal';
import { FilePreviewModal } from './FilePreviewModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { FileDetailsPanel } from './FileDetailsPanel';

const DESKTOP_NAME_MAX_LENGTH = 23;
const MOBILE_NAME_MAX_LENGTH = 16;
const READY_ITEM_DISPLAY_MS = 1500;
const PAGE_SIZE = 20;

type SortKey = 'name' | 'size' | 'modified';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';
type TypeFilter = 'all' | 'pdf' | 'images' | 'office' | 'other';

interface BrowserFileWithPath extends File {
  webkitRelativePath: string;
}

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
  all: 'All',
  pdf: 'PDF',
  images: 'Images',
  office: 'Docs',
  other: 'Other',
};

const PDF_EXTS = new Set(['pdf']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif']);
const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'txt', 'rtf']);

function getTypeCategory(ext: string): TypeFilter {
  const e = ext.toLowerCase();
  if (PDF_EXTS.has(e)) return 'pdf';
  if (IMAGE_EXTS.has(e)) return 'images';
  if (OFFICE_EXTS.has(e)) return 'office';
  return 'other';
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  pdf: 'bg-red-500/15 text-red-400',
  doc: 'bg-blue-500/15 text-blue-300',
  docx: 'bg-blue-500/15 text-blue-300',
  xls: 'bg-emerald-500/15 text-emerald-400',
  xlsx: 'bg-emerald-500/15 text-emerald-400',
  csv: 'bg-emerald-500/15 text-emerald-400',
  ppt: 'bg-orange-500/15 text-orange-300',
  pptx: 'bg-orange-500/15 text-orange-300',
  zip: 'bg-amber-500/15 text-amber-400',
};

function TypeBadge({ extension }: { extension: string }) {
  const ext = extension.toLowerCase();
  const classes =
    TYPE_BADGE_CLASSES[ext] ??
    (IMAGE_EXTS.has(ext) ? 'bg-violet-500/15 text-violet-300' : 'bg-app-s2 text-app-t3');
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {ext.slice(0, 4) || '—'}
    </span>
  );
}

function formatModified(dateStr: string): { date: string; relative: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateLabel =
    date.toDateString() === now.toDateString()
      ? `Today, ${time}`
      : date.toDateString() === yesterday.toDateString()
        ? `Yesterday, ${time}`
        : date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });

  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  const hours = Math.floor(diffMin / 60);
  const days = Math.floor(diffMin / 1440);
  const relative =
    diffMin < 1
      ? 'just now'
      : diffMin < 60
        ? `${diffMin} min ago`
        : diffMin < 1440
          ? `${hours} hr${hours === 1 ? '' : 's'} ago`
          : `${days} day${days === 1 ? '' : 's'} ago`;
  return { date: dateLabel, relative };
}

function getPageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function SortIcon({ sortKey, col, sortDir }: { sortKey: SortKey; col: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-app-t3" aria-hidden="true" />;
  return sortDir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3 text-app-t2" aria-hidden="true" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3 text-app-t2" aria-hidden="true" />
  );
}

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
  const { data: dashboardStats } = useDashboardStats();
  const orgStorage = dashboardStats && 'storage' in dashboardStats ? dashboardStats.storage : null;

  const multiInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [showStorageFull, setShowStorageFull] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileRecord | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileRecord | null>(null);

  // Drag-over counter avoids false leave events when cursor crosses child elements
  const [dragCounter, setDragCounter] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);

  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());

  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showCloudImport, setShowCloudImport] = useState<ImportProvider | null>(null);
  const { items: importItems } = useImportStore();
  const visibleImportItems = importItems.filter(
    (item) => item.dataRoomId === dataRoomId && item.folderId === folderId,
  );

  const visibleUploadItems = uploadItems.filter(
    (item) => item.dataRoomId === dataRoomId && item.folderId === folderId && !locallyDismissedIds.has(item.id),
  );
  const hasActiveUploads = visibleUploadItems.some(
    (item) => item.status === 'queued' || item.status === 'uploading' || item.status === 'processing',
  );

  const displayFiles = useMemo(() => {
    if (!files) return [];
    let result = typeFilter === 'all' ? files : files.filter((f) => getTypeCategory(f.extension) === typeFilter);
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'size') cmp = Number(a.sizeBytes) - Number(b.sizeBytes);
      else if (sortKey === 'modified') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [files, typeFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(displayFiles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedFiles = displayFiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pagedFiles.length > 0 && pagedFiles.every((f) => selectedIds.has(f.id));

  useEffect(() => {
    setPage(1);
  }, [folderId, search, typeFilter, sortKey, sortDir]);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', 'true');
      folderInputRef.current.setAttribute('directory', 'true');
    }
  }, []);

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
    // Proactive UX guard — the backend enforces the real quota regardless
    // (see FilesService.assertOrgStorageAvailable), this just avoids sending
    // uploads that are already known to fail.
    if (orgStorage && orgStorage.percentUsed >= 100) {
      setShowStorageFull(true);
      return;
    }
    for (const file of list) {
      enqueue({ dataRoomId, folderId, file, relativePath: file.webkitRelativePath || file.name, queryClient });
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragCounter(0);
    if (event.dataTransfer.files.length > 0) uploadFileList(event.dataTransfer.files);
  }

  function handleRename(file: FileRecord) {
    const name = window.prompt('Rename file', file.name);
    if (name && name !== file.name) updateFile.mutate({ fileId: file.id, name });
  }

  function handleDelete(file: FileRecord) {
    if (window.confirm(`Delete "${file.name}"?`)) {
      deleteFile.mutate(file.id);
      if (detailsFile?.id === file.id) setDetailsFile(null);
    }
  }

  function handleCreateFolder() {
    const name = window.prompt('New folder name');
    if (name) createFolder.mutate({ name, parentId: folderId ?? undefined });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setLastClickedIdx(null);
  }

  function toggleSelect(idx: number, shiftKey: boolean) {
    const file = pagedFiles[idx];
    if (!file) return;

    if (shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end = Math.max(lastClickedIdx, idx);
      const rangeIds = pagedFiles.slice(start, end + 1).map((f) => f.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      setLastClickedIdx(idx);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
        return next;
      });
    }
  }

  function toggleSelectAll() {
    if (!pagedFiles.length) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pagedFiles.forEach((f) => next.delete(f.id));
      } else {
        pagedFiles.forEach((f) => next.add(f.id));
      }
      return next;
    });
    setLastClickedIdx(null);
  }

  async function handleBulkDownload() {
    if (selectedIds.size === 0) return;
    setIsBulkDownloading(true);
    setError(null);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await bulkDownloadFiles(dataRoomId, Array.from(selectedIds), `data-room-export-${dateStr}.zip`);
      clearSelection();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsBulkDownloading(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Permanently delete ${count} file${count === 1 ? '' : 's'}?`)) return;
    setIsBulkDeleting(true);
    setError(null);
    const idsToDelete = Array.from(selectedIds);
    try {
      for (const id of idsToDelete) {
        await deleteFile.mutateAsync(id);
      }
      clearSelection();
      if (detailsFile && idsToDelete.includes(detailsFile.id)) setDetailsFile(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function handleSortHeader(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const isDragOver = dragCounter > 0;

  return (
    <div
      onDragEnter={(e) => {
        if (canUpload && e.dataTransfer.types.includes('Files')) setDragCounter((c) => c + 1);
      }}
      onDragLeave={() => setDragCounter((c) => Math.max(0, c - 1))}
      onDragOver={(e) => {
        if (canUpload) e.preventDefault();
      }}
      onDrop={canUpload ? handleDrop : undefined}
      className={`relative rounded-lg ${isDragOver ? 'ring-2 ring-brand-400' : ''}`}
    >
      {/* Drop overlay */}
      {isDragOver && canUpload && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-app-s1/90 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-app-primary px-8 py-6">
            <Upload className="h-8 w-8 text-app-t3" aria-hidden="true" />
            <p className="text-sm font-medium text-app-t2">Drop to upload</p>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
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

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canUpload && (
          <div className="relative">
            <button
              onClick={() => setShowUploadMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-app-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500/100"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Upload
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {showUploadMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUploadMenu(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-app-border bg-app-s1 py-1.5 shadow-dark-popover">
                  <button
                    onClick={() => { multiInputRef.current?.click(); setShowUploadMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-app-t2 hover:bg-app-s2"
                  >
                    📄 Upload Files
                  </button>
                  <button
                    onClick={() => { folderInputRef.current?.click(); setShowUploadMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-app-t2 hover:bg-app-s2"
                  >
                    📁 Upload Folder
                  </button>
                  <div className="my-1 border-t border-app-border" />
                  <button
                    onClick={() => { setShowCloudImport('google-drive'); setShowUploadMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-app-t2 hover:bg-app-s2"
                  >
                    <Cloud className="h-3.5 w-3.5 text-app-t3" aria-hidden="true" />
                    Import from Google Drive
                  </button>
                  <button
                    onClick={() => { setShowCloudImport('onedrive'); setShowUploadMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-app-t2 hover:bg-app-s2"
                  >
                    <Cloud className="h-3.5 w-3.5 text-app-t3" aria-hidden="true" />
                    Import from Microsoft OneDrive
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex overflow-hidden rounded-md border border-app-border">
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2 py-1.5 ${viewMode === 'list' ? 'bg-app-primary text-white' : 'bg-app-s1 text-app-t3 hover:bg-app-s2'}`}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`px-2 py-1.5 ${viewMode === 'grid' ? 'bg-app-primary text-white' : 'bg-app-s1 text-app-t3 hover:bg-app-s2'}`}
            >
              <Grid3X3 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Type filter chips */}
      {files && files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(Object.keys(TYPE_FILTER_LABELS) as TypeFilter[]).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-app-primary text-white'
                  : 'bg-app-s2 text-app-t2 hover:bg-app-s3'
              }`}
            >
              {TYPE_FILTER_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-app-primary/30 bg-app-primary/10 px-4 py-2.5 shadow-dark-soft">
          <span className="text-sm font-semibold text-blue-300">
            {selectedIds.size} selected
          </span>
          {canDownload && (
            <button
              onClick={handleBulkDownload}
              disabled={isBulkDownloading}
              className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-s1 px-3 py-1.5 text-sm font-medium text-app-t2 hover:bg-app-s2 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {isBulkDownloading ? 'Preparing ZIP…' : 'Download ZIP'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="rounded-lg border border-red-500/30 bg-app-s1 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              {isBulkDeleting ? 'Deleting…' : 'Delete selected'}
            </button>
          )}
          <button onClick={clearSelection} className="ml-auto text-xs font-medium text-app-t3 hover:text-app-text">
            Clear selection
          </button>
        </div>
      )}

      {error && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <UploadProgressPanel items={visibleUploadItems} />
      <ImportProgressPanel items={visibleImportItems} />

      {/* Main content area: file list/grid + optional details panel */}
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-app-border bg-app-s1 px-4 py-3">
                  <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
                  <Skeleton className="h-3.5 flex-1 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              ))}
            </div>
          ) : displayFiles.length === 0 && !hasActiveUploads ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-app-border2 p-12 text-center">
              <FolderOpen className="h-10 w-10 text-app-t4" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-app-t2">
                {typeFilter !== 'all' ? 'No files in this category' : 'This folder is empty'}
              </p>
              {canUpload && typeFilter === 'all' ? (
                <>
                  <p className="mt-1 text-sm text-app-t3">Drag &amp; drop files here, or use the buttons above.</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => multiInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-app-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500/100"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      Upload files
                    </button>
                    <button
                      onClick={handleCreateFolder}
                      className="inline-flex items-center gap-1.5 rounded-md border border-app-border2 px-3 py-1.5 text-sm text-app-t2 hover:bg-app-s2"
                    >
                      <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      New folder
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-app-t3">No files have been added to this folder yet.</p>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid view */
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pagedFiles.map((file, idx) => {
                const Icon = getFileIcon(file.extension);
                const isSelected = selectedIds.has(file.id);
                const isActive = detailsFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    draggable={canUpload}
                    onDragStart={(e) => e.dataTransfer.setData('text/file-id', file.id)}
                    onClick={() => setDetailsFile(isActive ? null : file)}
                    className={`group relative cursor-pointer rounded-lg border p-3 transition-colors ${
                      isSelected || isActive
                        ? 'border-app-border2 bg-app-s2'
                        : 'border-app-border bg-app-s1 hover:border-app-border2 hover:bg-app-s2'
                    }`}
                  >
                    {canDownload && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(idx, e.shiftKey);
                        }}
                        className={`absolute left-2 top-2 h-4 w-4 rounded border-app-border2 ${
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      />
                    )}
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <Icon className="h-10 w-10 text-app-t3" aria-hidden="true" />
                      <Tooltip label={file.name} side="top">
                        <p className="w-full truncate text-center text-xs font-medium text-app-t2">
                          {file.name}
                        </p>
                      </Tooltip>
                      <p className="text-xs text-app-t3">{formatBytes(file.sizeBytes)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="overflow-hidden rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-app-border bg-app-s2/60 text-xs">
                  <tr>
                    {canDownload && (
                      <th className="w-8 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-app-border2 accent-app-primary"
                        />
                      </th>
                    )}
                    <th
                      className="cursor-pointer select-none px-4 py-3 font-semibold uppercase tracking-wide text-app-t3 hover:text-app-t2"
                      onClick={() => handleSortHeader('name')}
                    >
                      Name
                      <SortIcon sortKey={sortKey} col="name" sortDir={sortDir} />
                    </th>
                    <th className="hidden w-20 px-4 py-3 font-semibold uppercase tracking-wide text-app-t3 sm:table-cell">
                      Type
                    </th>
                    <th
                      className="w-24 cursor-pointer select-none px-4 py-3 font-semibold uppercase tracking-wide text-app-t3 hover:text-app-t2"
                      onClick={() => handleSortHeader('size')}
                    >
                      Size
                      <SortIcon sortKey={sortKey} col="size" sortDir={sortDir} />
                    </th>
                    <th
                      className="w-40 cursor-pointer select-none px-4 py-3 font-semibold uppercase tracking-wide text-app-t3 hover:text-app-t2"
                      onClick={() => handleSortHeader('modified')}
                    >
                      Modified
                      <SortIcon sortKey={sortKey} col="modified" sortDir={sortDir} />
                    </th>
                    <th className="hidden w-44 px-4 py-3 font-semibold uppercase tracking-wide text-app-t3 lg:table-cell">
                      Uploaded by
                    </th>
                    <th className="hidden w-14 px-2 py-3 md:table-cell" />
                    <th className="w-36 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {pagedFiles.map((file, idx) => {
                    const isSelected = selectedIds.has(file.id);
                    const isActive = detailsFile?.id === file.id;
                    const FileIcon = getFileIcon(file.extension);
                    const modified = formatModified(file.updatedAt);
                    return (
                      <tr
                        key={file.id}
                        draggable={canUpload}
                        onDragStart={(e) => e.dataTransfer.setData('text/file-id', file.id)}
                        onClick={() => setDetailsFile(isActive ? null : file)}
                        className={`group cursor-pointer hover:bg-app-s2/60 ${isSelected || isActive ? 'bg-app-s2' : ''}`}
                      >
                        {canDownload && (
                          <td className="w-8 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(idx, e.shiftKey);
                              }}
                              className="h-4 w-4 rounded border-app-border2 accent-app-primary"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <FileIcon className="h-4 w-4 flex-shrink-0 text-app-t3" aria-hidden="true" />
                            <Tooltip label={file.name} side="top">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                }}
                                className="truncate font-medium text-app-text hover:text-app-primary hover:underline"
                              >
                                {truncateFilename(file.name, nameMaxLength)}
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 sm:table-cell">
                          <TypeBadge extension={file.extension} />
                        </td>
                        <td className="overflow-hidden whitespace-nowrap px-4 py-3 text-app-t3">
                          {formatBytes(file.sizeBytes)}
                        </td>
                        <td className="overflow-hidden whitespace-nowrap px-4 py-3">
                          <p className="text-xs text-app-t2">{modified.date}</p>
                          <p className="text-[11px] text-emerald-400">{modified.relative}</p>
                        </td>
                        <td className="hidden overflow-hidden px-4 py-3 lg:table-cell">
                          {file.uploader ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={`${file.uploader.firstName} ${file.uploader.lastName}`}
                                size="sm"
                              />
                              <span className="truncate text-xs text-app-t2">
                                {file.uploader.firstName} {file.uploader.lastName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-app-t4">—</span>
                          )}
                        </td>
                        <td className="hidden px-2 py-3 md:table-cell">
                          {file.currentVersion && (
                            <span className="rounded bg-app-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                              v{file.currentVersion.versionNumber}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {canDownload && (
                              <Tooltip label="Download" side="top">
                                <button
                                  onClick={() =>
                                    downloadFile(
                                      dataRoomId,
                                      file.id,
                                      getPreviewFilename(file.name, file.extension),
                                    )
                                  }
                                  className="rounded-md p-1.5 text-app-t3 hover:bg-app-s2 hover:text-app-t2"
                                >
                                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip label="Version history" side="top">
                              <button
                                onClick={() => setVersionsFile(file)}
                                className="rounded-md p-1.5 text-app-t3 hover:bg-app-s2 hover:text-app-t2"
                              >
                                <History className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </Tooltip>
                            {canUpload && (
                              <Tooltip label="Rename" side="top">
                                <button
                                  onClick={() => handleRename(file)}
                                  className="rounded-md p-1.5 text-app-t3 hover:bg-app-s2 hover:text-app-t2"
                                >
                                  <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip label="Delete" side="top">
                                <button
                                  onClick={() => handleDelete(file)}
                                  className="rounded-md p-1.5 text-app-t3 hover:bg-red-500/10 hover:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {displayFiles.length > PAGE_SIZE && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-app-t4">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(currentPage * PAGE_SIZE, displayFiles.length)} of {displayFiles.length}{' '}
                files
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="rounded-lg border border-app-border p-1.5 text-app-t3 transition-colors hover:bg-app-s2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {getPageWindow(currentPage, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-app-t4">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      aria-current={p === currentPage ? 'page' : undefined}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                        p === currentPage
                          ? 'bg-app-primary text-white'
                          : 'border border-app-border text-app-t3 hover:bg-app-s2'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  className="rounded-lg border border-app-border p-1.5 text-app-t3 transition-colors hover:bg-app-s2 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Details panel */}
        {detailsFile && (
          <FileDetailsPanel
            dataRoomId={dataRoomId}
            file={detailsFile}
            canDownload={canDownload}
            canUpload={canUpload}
            canDelete={canDelete}
            onClose={() => setDetailsFile(null)}
            onPreview={() => {
              setPreviewFile(detailsFile);
              setDetailsFile(null);
            }}
            onVersions={() => {
              setVersionsFile(detailsFile);
              setDetailsFile(null);
            }}
            onRename={() => handleRename(detailsFile)}
            onDelete={() => handleDelete(detailsFile)}
          />
        )}
      </div>

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
      {showCloudImport && (
        <CloudImportModal
          dataRoomId={dataRoomId}
          folderId={folderId}
          initialProvider={showCloudImport}
          onClose={() => setShowCloudImport(null)}
        />
      )}
      {orgStorage && (
        <StorageUpgradeDialog
          open={showStorageFull}
          onClose={() => setShowStorageFull(false)}
          currentGb={orgStorage.limitGb}
        />
      )}
    </div>
  );
}
