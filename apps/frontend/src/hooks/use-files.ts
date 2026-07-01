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
  createdAt: string;
  updatedAt: string;
}

interface FilesQuery {
  folderId?: string | null;
  search?: string;
}

export function useFiles(dataRoomId: string, query: FilesQuery) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'files', query],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (query.search) {
        params.search = query.search;
      } else if (query.folderId) {
        params.folderId = query.folderId;
      }
      const response = await apiClient.get<{ data: FileRecord[] }>(`/data-rooms/${dataRoomId}/files`, {
        params,
      });
      return response.data.data;
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
