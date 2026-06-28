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

export function useAuth() {
  const router = useRouter();
  const { user, accessToken, isInitializing, setAuth, clearAuth } = useAuthStore();

  const login = useCallback(
    async (input: LoginInput) => {
      try {
        const response = await apiClient.post('/auth/login', input);
        const { accessToken: token, user: loggedInUser } = response.data.data;
        setAuth(loggedInUser, token);
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
    logout,
    forgotPassword,
    resetPassword,
    acceptInvite,
  };
}
