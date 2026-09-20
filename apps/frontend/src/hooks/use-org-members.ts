import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@variedreach-vdr/shared';

export interface OrgMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isOwner: boolean;
  membershipStatus: 'ACTIVE' | 'SUSPENDED';
  accountStatus: string;
  lastLoginAt: string | null;
  memberSince: string;
}

export function useOrgMembers(organisationId: string) {
  return useQuery({
    queryKey: ['organisations', organisationId, 'members'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: OrgMember[] }>(
        `/organisations/${organisationId}/members`,
      );
      return response.data.data;
    },
    enabled: Boolean(organisationId),
  });
}

export function useUpdateOrgMemberStatus(organisationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'ACTIVE' | 'SUSPENDED' }) => {
      await apiClient.patch(`/organisations/${organisationId}/members/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations', organisationId, 'members'] });
    },
  });
}
