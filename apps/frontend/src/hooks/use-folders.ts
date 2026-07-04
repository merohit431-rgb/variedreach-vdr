import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface FolderNode {
  id: string;
  dataRoomId: string;
  parentId: string | null;
  name: string;
  path: string;
  depth: number;
  sortOrder: number;
}

export function useFolders(dataRoomId: string) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'folders'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: FolderNode[] }>(`/data-rooms/${dataRoomId}/folders`);
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useCreateFolder(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; parentId?: string }) => {
      const response = await apiClient.post<{ data: FolderNode }>(
        `/data-rooms/${dataRoomId}/folders`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders'] });
    },
  });
}

export function useUpdateFolder(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      folderId,
      ...input
    }: {
      folderId: string;
      name?: string;
      parentId?: string | null;
    }) => {
      const response = await apiClient.patch<{ data: FolderNode }>(
        `/data-rooms/${dataRoomId}/folders/${folderId}`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders'] });
    },
  });
}

export function useDeleteFolder(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      await apiClient.delete(`/data-rooms/${dataRoomId}/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders'] });
    },
  });
}

export function useCopyFolder(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, targetParentId }: { folderId: string; targetParentId?: string | null }) => {
      const response = await apiClient.post<{ data: FolderNode }>(
        `/data-rooms/${dataRoomId}/folders/${folderId}/copy`,
        { targetParentId: targetParentId ?? undefined },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'files'] });
    },
  });
}
