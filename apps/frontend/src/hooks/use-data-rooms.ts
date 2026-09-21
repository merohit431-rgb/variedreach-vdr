import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DataRoomType, UserRole } from '@variedreach-vdr/shared';

export interface DataRoomAccess {
  effectiveRole: UserRole;
  canManageRoom: boolean;
  canUploadContent: boolean;
  canDeleteContent: boolean;
  canDownload: boolean;
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
  deletedAt?: string | null;
}

export interface CreateDataRoomInput {
  name: string;
  type: DataRoomType;
  caseNumber?: string;
  startDate?: string;
  endDate?: string;
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

// findAll/findOne both filter deletedAt: null, so this is the only way a
// deleted room is discoverable at all -- without it there's no id to pass
// to useRestoreDataRoom. Manager-only on the backend (@Roles), so a 403
// here for a non-manager is expected, not a bug -- callers should only
// mount this for canManage-equivalent users.
export function useDeletedDataRooms(enabled: boolean) {
  return useQuery({
    queryKey: ['data-rooms', 'deleted'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DataRoom[] }>('/data-rooms/deleted');
      return response.data.data;
    },
    enabled,
  });
}

export function useRestoreDataRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ data: DataRoom }>(`/data-rooms/${id}/restore`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', 'deleted'] });
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

export interface DataRoomStats {
  documents: number;
  // Management-only figures: the backend returns null for non-managers, and
  // the room header hides the corresponding cards for them.
  members: number | null;
  storageUsedBytes: string | null;
  storageLimitGb: number | null;
  lastActivityAt: string | null;
  lastActivityAction: string | null;
  folderCounts: Record<string, number>;
}

export function useDataRoomStats(id: string) {
  return useQuery({
    queryKey: ['data-rooms', id, 'stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DataRoomStats }>(`/data-rooms/${id}/stats`);
      return response.data.data;
    },
    enabled: Boolean(id),
    refetchInterval: 60_000,
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

export interface SecuritySettings {
  ipAllowlistEnabled?: boolean;
  allowedIps?: string[];
  ndaEnabled?: boolean;
  ndaText?: string | null;
  watermarkTemplate?: string;
  watermarkOpacity?: number;
  watermarkPosition?: 'diagonal' | 'tiled';
}

export function useUpdateSecuritySettings(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: SecuritySettings) => {
      const response = await apiClient.patch<{ data: DataRoom }>(
        `/data-rooms/${id}/security`,
        settings,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', id] });
      queryClient.invalidateQueries({ queryKey: ['data-rooms', id, 'nda'] });
    },
  });
}
