import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DataRoomType, UserRole, DownloadPolicy } from '@variedreach-vdr/shared';

export interface DataRoomAccess {
  effectiveRole: UserRole;
  canManageRoom: boolean;
  canUploadContent: boolean;
  canDeleteContent: boolean;
  canDownload: boolean;
  downloadPolicy: DownloadPolicy;
  availableDownloadFormats: ('original' | 'watermarked')[];
}

export interface DataRoom {
  id: string;
  name: string;
  type: DataRoomType;
  caseNumber: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';
  startDate: string | null;
  endDate: string | null;
  storageUsedBytes: string;
  createdAt: string;
}

export interface CreateDataRoomInput {
  name: string;
  type: DataRoomType;
  caseNumber?: string;
  startDate?: string;
  endDate?: string;
  downloadPolicy?: DownloadPolicy;
}

export function useDataRooms() {
  return useQuery({
    queryKey: ['data-rooms'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DataRoom[] }>('/data-rooms');
      return response.data.data;
    },
  });
}

export function useDataRoom(id: string) {
  return useQuery({
    queryKey: ['data-rooms', id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DataRoom }>(`/data-rooms/${id}`);
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useDataRoomAccess(id: string) {
  return useQuery({
    queryKey: ['data-rooms', id, 'access'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DataRoomAccess }>(`/data-rooms/${id}/access`);
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateDataRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDataRoomInput) => {
      const response = await apiClient.post<{ data: DataRoom }>('/data-rooms', input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms'] });
    },
  });
}

export function useUpdateDataRoom(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateDataRoomInput>) => {
      const response = await apiClient.patch<{ data: DataRoom }>(`/data-rooms/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', id] });
    },
  });
}

export function useSetDataRoomArchived(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (archived: boolean) => {
      const response = await apiClient.post<{ data: DataRoom }>(
        `/data-rooms/${id}/${archived ? 'archive' : 'unarchive'}`,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', id] });
    },
  });
}

export function useDeleteDataRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/data-rooms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms'] });
    },
  });
}
