import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface FileVersionSummary {
  id: string;
  versionNumber: number;
  sizeBytes: string;
  mimeType: string;
  checksum: string;
  uploadedBy: string;
  comment: string | null;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  dataRoomId: string;
  folderId: string | null;
  name: string;
  description: string | null;
  mimeType: string;
  extension: string;
  sizeBytes: string;
  currentVersionId: string | null;
  currentVersion: FileVersionSummary | null;
  isLocked: boolean;
  uploadedBy: string;
  uploader?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilesPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilesQuery {
  folderId?: string | null;
  search?: string;
  // Phase 4 finding P4-05: the endpoint is now paginated (previously
  // returned every file in one unbounded response -- measured at 5.65MB/
  // 2.65s for 10,000 files). Defaulting to the backend's own generous
  // FILES_DEFAULT_LIMIT (200) here keeps every room at today's typical
  // scale rendering exactly as before, with no UI change required; a room
  // that actually exceeds one page is the one case that needs a real
  // "load more"/paged browsing UI, which is a deliberate follow-up, not
  // silently handled by this hook -- meta.totalPages is exposed so that
  // follow-up has what it needs without another backend change.
  page?: number;
  limit?: number;
}

export function useFiles(dataRoomId: string, query: FilesQuery) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'files', query],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: query.page ?? 1, limit: query.limit ?? 200 };
      if (query.search) {
        params.search = query.search;
      } else if (query.folderId) {
        params.folderId = query.folderId;
      }
      const response = await apiClient.get<{ data: FileRecord[]; meta: FilesPageMeta }>(
        `/data-rooms/${dataRoomId}/files`,
        { params },
      );
      return response.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useUploadFiles(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      files,
      folderId,
      relativePaths,
    }: {
      files: File[];
      folderId?: string | null;
      relativePaths?: string[];
    }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (folderId) formData.append('folderId', folderId);
      if (relativePaths) formData.append('relativePaths', JSON.stringify(relativePaths));

      const response = await apiClient.post<{ data: FileRecord[] }>(
        `/data-rooms/${dataRoomId}/files`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId] });
    },
  });
}

export function useUpdateFile(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fileId,
      ...input
    }: {
      fileId: string;
      name?: string;
      folderId?: string | null;
    }) => {
      const response = await apiClient.patch<{ data: FileRecord }>(
        `/data-rooms/${dataRoomId}/files/${fileId}`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files'] });
    },
  });
}

export function useDeleteFile(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiClient.delete(`/data-rooms/${dataRoomId}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId] });
    },
  });
}

export interface BulkDeleteResult {
  deletedIds: string[];
  notFoundIds: string[];
}

// One real request instead of a client-side loop of single deletes: atomic
// at the SQL level, one audit-log entry, and a structured result so a
// partial mismatch (a file someone else already deleted a moment ago)
// is reported precisely instead of surfacing as one generic error.
export function useBulkDeleteFiles(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fileIds: string[]) => {
      const response = await apiClient.post<{ data: BulkDeleteResult }>(
        `/data-rooms/${dataRoomId}/files/bulk-delete`,
        { fileIds },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId] });
    },
  });
}

export function useFileVersions(dataRoomId: string, fileId: string | null) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'files', fileId, 'versions'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: FileVersionSummary[] }>(
        `/data-rooms/${dataRoomId}/files/${fileId}/versions`,
      );
      return response.data.data;
    },
    enabled: Boolean(fileId),
  });
}

export interface ArchiveEntryInfo {
  name: string;
  isDirectory: boolean;
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
  isEncrypted: boolean;
  suspiciousPath: boolean;
  suspiciouslyHighRatio: boolean;
}

export interface ArchiveListing {
  entries: ArchiveEntryInfo[];
  totalEntries: number;
  truncated: boolean;
  suspiciousTotalSize: boolean;
}

// Phase 3D: ZIP-only metadata listing -- `enabled` should be gated on the
// file actually being a .zip by the caller, since the backend itself 400s
// for 7z/rar (no safe listing library exists for either).
export function useArchiveListing(dataRoomId: string, fileId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'files', fileId, 'archive-listing'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: ArchiveListing }>(
        `/data-rooms/${dataRoomId}/files/${fileId}/archive-listing`,
      );
      return response.data.data;
    },
    enabled: Boolean(fileId) && enabled,
  });
}

export function useAddFileVersion(dataRoomId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, comment }: { file: File; comment?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (comment) formData.append('comment', comment);

      const response = await apiClient.post<{ data: FileVersionSummary }>(
        `/data-rooms/${dataRoomId}/files/${fileId}/versions`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files', fileId, 'versions'] });
    },
  });
}

export async function fetchFileBlob(path: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
  return response.data;
}

export async function downloadFile(dataRoomId: string, fileId: string, filename: string, versionId?: string) {
  const path = versionId
    ? `/data-rooms/${dataRoomId}/files/${fileId}/versions/${versionId}/download`
    : `/data-rooms/${dataRoomId}/files/${fileId}/download`;
  const blob = await fetchFileBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Option B: the exact original, unwatermarked binary -- gated server-side by
// the dedicated DOWNLOAD_ORIGINAL permission, not by canDownload. filename
// is the file's own stored name (no "(preview).pdf" renaming the way the
// watermarked download does for Office files, since this is never converted).
export async function downloadOriginalFile(dataRoomId: string, fileId: string, filename: string) {
  const blob = await fetchFileBlob(`/data-rooms/${dataRoomId}/files/${fileId}/download-original`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function bulkDownloadFiles(dataRoomId: string, fileIds: string[], filename: string) {
  const response = await apiClient.post<Blob>(
    `/data-rooms/${dataRoomId}/files/bulk-download`,
    { fileIds },
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadFolder(dataRoomId: string, folderId: string | null, filename: string) {
  const response = await apiClient.post<Blob>(
    `/data-rooms/${dataRoomId}/files/folder-download`,
    { folderId: folderId ?? undefined },
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
