'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useMfaStatus() {
  return useQuery({
    queryKey: ['auth', 'mfa-status'],
    queryFn: async () => {
      const response = await apiClient.get<{ totpEnabled: boolean }>('/auth/mfa/status');
      return response.data;
    },
  });
}

export interface MfaSetupResult {
  qrCodeDataUrl: string;
  secret: string;
}

export function useSetupMfa() {
  return useMutation({
    mutationFn: async (): Promise<MfaSetupResult> => {
      const response = await apiClient.post<{ data: MfaSetupResult }>('/auth/mfa/setup');
      return response.data.data;
    },
  });
}

export function useVerifyMfaSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (totpCode: string) => {
      await apiClient.post('/auth/mfa/verify-setup', { totpCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
    },
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (totpCode: string) => {
      await apiClient.delete('/auth/mfa/disable', { data: { totpCode } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
    },
  });
}

export function useVerifyMfaLogin() {
  return useMutation({
    mutationFn: async (input: {
      mfaChallengeToken: string;
      totpCode: string;
      rememberMe?: boolean;
    }) => {
      const response = await apiClient.post<{
        data: { accessToken: string; user: { id: string; email: string; firstName: string; lastName: string; role: string; organisationId: string } };
      }>('/auth/mfa/verify-login', input);
      return response.data.data;
    },
  });
}
