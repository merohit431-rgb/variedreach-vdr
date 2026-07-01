'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface NdaStatus {
  enabled: boolean;
  text: string | null;
  hasAccepted: boolean;
}

export function useNdaStatus(dataRoomId: string) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'nda'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: NdaStatus }>(`/data-rooms/${dataRoomId}/nda`);
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useAcceptNda(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post(`/data-rooms/${dataRoomId}/nda/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'nda'] });
    },
  });
}
