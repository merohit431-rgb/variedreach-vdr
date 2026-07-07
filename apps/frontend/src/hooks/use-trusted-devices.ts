'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface TrustedDeviceSummary {
  id: string;
  label: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

const TRUSTED_DEVICES_KEY = ['auth', 'trusted-devices'];

export function useTrustedDevices() {
  return useQuery({
    queryKey: TRUSTED_DEVICES_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: TrustedDeviceSummary[] }>('/auth/trusted-devices');
      return response.data.data;
    },
  });
}

export function useRevokeTrustedDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string) => {
      await apiClient.delete(`/auth/trusted-devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUSTED_DEVICES_KEY });
    },
  });
}
