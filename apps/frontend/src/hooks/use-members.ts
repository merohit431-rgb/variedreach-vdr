import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@variedreach-vdr/shared';

export interface Member {
  userId: string;
  dataRoomId: string;
  roleOverride: UserRole | null;
  invitedAt: string;
  joinedAt: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: string;
  };
}

export function useMembers(dataRoomId: string) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'members'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Member[] }>(`/data-rooms/${dataRoomId}/members`);
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useInviteMember(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role: UserRole }) => {
      const response = await apiClient.post<{ data: { emailSent: boolean } }>(
        `/data-rooms/${dataRoomId}/members/invite`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'members'] });
    },
  });
}

export function useResendInvite(dataRoomId: string) {
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post<{ data: { emailSent: boolean } }>(
        `/data-rooms/${dataRoomId}/members/${userId}/resend-invite`,
      );
      return response.data.data;
    },
  });
}

export function useUpdateMemberRole(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      await apiClient.patch(`/data-rooms/${dataRoomId}/members/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'members'] });
    },
  });
}

export function useRemoveMember(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/data-rooms/${dataRoomId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'members'] });
    },
  });
}

export function useResetMemberPassword(dataRoomId: string) {
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.post(`/data-rooms/${dataRoomId}/members/${userId}/reset-password`);
    },
  });
}
