import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { extractErrorMessage } from '@/lib/error-message';
import type { PlanId } from '@variedreach-vdr/shared';

export interface RegisterInput {
  fullName: string;
  companyName: string;
  email: string;
  mobileNumber: string;
  password: string;
  gstNumber?: string;
  companyAddress?: string;
  selectedPlan: PlanId;
  selectedStorageGb: number;
}

export function useRegistration() {
  const register = useCallback(async (input: RegisterInput) => {
    try {
      await apiClient.post('/registrations', input);
      return { success: true as const };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    try {
      await apiClient.post('/registrations/verify-email', { token });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    try {
      await apiClient.post('/registrations/resend-verification', { email });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  return { register, verifyEmail, resendVerification };
}
