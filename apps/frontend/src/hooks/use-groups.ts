import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface GroupSummary {
  id: string;
  name: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  addedAt: string;
}

export interface GroupFolderGrant {
  folderId: string;
  folderName: string;
  dataRoomId: string;
  grantedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  isActive: boolean;
  members: GroupMember[];
  folderGrants: GroupFolderGrant[];
}

export function useGroups(organisationId: string) {
  return useQuery({
    queryKey: ['organisations', organisationId, 'groups'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: GroupSummary[] }>(`/organisations/${organisationId}/groups`);
      return response.data.data;
    },
    enabled: Boolean(organisationId),
  });
}

export function useGroup(organisationId: string, groupId: string | null) {
  return useQuery({
    queryKey: ['organisations', organisationId, 'groups', groupId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: GroupDetail }>(`/organisations/${organisationId}/groups/${groupId}`);
      return response.data.data;
    },
    enabled: Boolean(organisationId) && Boolean(groupId),
  });
}

export function useCreateGroup(organisationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await apiClient.post<{ data: GroupSummary }>(`/organisations/${organisationId}/groups`, { name });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups'] });
    },
  });
}

export function useUpdateGroup(organisationId: string, groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; isActive?: boolean }) => {
      await apiClient.patch(`/organisations/${organisationId}/groups/${groupId}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups'] });
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups', groupId] });
    },
  });
}

export function useAddGroupMember(organisationId: string, groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.post(`/organisations/${organisationId}/groups/${groupId}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups'] });
    },
  });
}

export function useRemoveGroupMember(organisationId: string, groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/organisations/${organisationId}/groups/${groupId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'groups'] });
    },
  });
}
