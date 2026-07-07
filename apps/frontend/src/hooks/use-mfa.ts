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

// ── Email OTP — the 2FA mechanism actually exposed in Settings + the login flow ──

export interface EmailOtpStatus {
  enabled: boolean;
  required: boolean;
}

export function useEmailOtpStatus() {
  return useQuery({
    queryKey: ['auth', 'email-otp-status'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: EmailOtpStatus }>('/auth/mfa/email-otp/status');
      return response.data.data;
    },
  });
}

export function useEnableEmailOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/mfa/email-otp/enable');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'email-otp-status'] });
    },
  });
}

export function useDisableEmailOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (currentPassword: string) => {
      await apiClient.post('/auth/mfa/email-otp/disable', { currentPassword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'email-otp-status'] });
    },
  });
}

export interface AuthenticatedUserResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organisationId: string;
}

export function useVerifyEmailOtpLogin() {
  return useMutation({
    mutationFn: async (input: {
      mfaChallengeToken: string;
      code: string;
      rememberMe?: boolean;
      trustDevice?: boolean;
    }) => {
      const response = await apiClient.post<{ data: { accessToken: string; user: AuthenticatedUserResult } }>(
        '/auth/mfa/verify-email-otp',
        input,
      );
      return response.data.data;
    },
  });
}

export function useResendEmailOtp() {
  return useMutation({
    mutationFn: async (mfaChallengeToken: string) => {
      const response = await apiClient.post<{ data: { sent: true; mfaChallengeToken: string } }>(
        '/auth/mfa/resend-email-otp',
        { mfaChallengeToken },
      );
      return response.data.data;
    },
  });
}
