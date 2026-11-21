import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface FolderAccessGrant {
  userId: string;
  name: string;
  email: string;
  grantedAt: string;
  grantedBy: string;
}

export type FolderAccessSource =
  | { type: 'own' }
  | { type: 'inherited'; folderId: string; folderName: string }
  | { type: 'none' };

export interface FolderAccessInfo {
  folderId: string;
  folderName: string;
  explicitGrants: FolderAccessGrant[];
  effectiveSource: FolderAccessSource;
}

export function useFolderAccess(dataRoomId: string, folderId: string | null) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'folders', folderId, 'access'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: FolderAccessInfo }>(
        `/data-rooms/${dataRoomId}/folders/${folderId}/access`,
      );
      return response.data.data;
    },
    enabled: Boolean(dataRoomId) && Boolean(folderId),
  });
}

export function useGrantFolderAccess(dataRoomId: string, folderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.post(`/data-rooms/${dataRoomId}/folders/${folderId}/access`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders', folderId, 'access'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders'] });
    },
  });
}

export function useRevokeFolderAccess(dataRoomId: string, folderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/data-rooms/${dataRoomId}/folders/${folderId}/access/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders', folderId, 'access'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'folders'] });
    },
  });
}
