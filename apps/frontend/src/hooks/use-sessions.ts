'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SessionSummary {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  location: string | null;
  rememberMe: boolean;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

const SESSIONS_KEY = ['auth', 'sessions'];

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: SessionSummary[] }>('/auth/sessions');
      return response.data.data;
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(`/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: { revoked: number } }>('/auth/sessions/revoke-others');
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}
