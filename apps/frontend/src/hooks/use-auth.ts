import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { extractErrorMessage } from '@/lib/error-message';

interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface WorkspaceOption {
  organisationId: string;
  organisationName: string;
  role: string;
}

export function useAuth() {
  const router = useRouter();
  const { user, accessToken, isInitializing, setAuth, clearAuth } = useAuthStore();

  const login = useCallback(
    async (input: LoginInput) => {
      try {
        const response = await apiClient.post('/auth/login', input);
        const data = response.data.data;
        if (data.requiresMfa) {
          return {
            success: true as const,
            requiresMfa: true as const,
            requiresWorkspaceSelection: false as const,
            mfaChallengeToken: data.mfaChallengeToken as string,
            mfaMethod: data.mfaMethod as 'EMAIL_OTP' | 'TOTP',
          };
        }
        if (data.requiresWorkspaceSelection) {
          return {
            success: true as const,
            requiresMfa: false as const,
            requiresWorkspaceSelection: true as const,
            workspaceSelectionToken: data.workspaceSelectionToken as string,
            workspaces: data.workspaces as WorkspaceOption[],
          };
        }
        setAuth(data.user, data.accessToken);
        return { success: true as const, requiresMfa: false as const, requiresWorkspaceSelection: false as const };
      } catch (error) {
        return { success: false as const, message: extractErrorMessage(error) };
      }
    },
    [setAuth],
  );

  const selectWorkspace = useCallback(
    async (workspaceSelectionToken: string, organisationId: string) => {
      try {
        const response = await apiClient.post('/auth/select-workspace', { workspaceSelectionToken, organisationId });
        const data = response.data.data;
        setAuth(data.user, data.accessToken);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, message: extractErrorMessage(error) };
      }
    },
    [setAuth],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAuth();
      router.push('/login');
    }
  }, [clearAuth, router]);

  const logoutEverywhere = useCallback(async () => {
    try {
      await apiClient.post('/auth/sessions/revoke-all');
    } finally {
      clearAuth();
      router.push('/login');
    }
  }, [clearAuth, router]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await apiClient.post('/auth/forgot-password', { email });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const acceptInvite = useCallback(async (token: string, password: string) => {
    try {
      await apiClient.post('/auth/accept-invite', { token, password });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  return {
    user,
    accessToken,
    isInitializing,
    login,
    selectWorkspace,
    logout,
    logoutEverywhere,
    forgotPassword,
    resetPassword,
    acceptInvite,
  };
}
