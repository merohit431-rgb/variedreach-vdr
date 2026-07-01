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
      const res = await apiClient.post<{ email: string }>('/registrations/verify-email', { token });
      return { success: true as const, email: res.data.email };
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

  const getDetails = useCallback(async (email: string) => {
    try {
      const res = await apiClient.get<{ selectedPlan: string; selectedStorageGb: number; billingCycle: string }>(
        `/registrations/details?email=${encodeURIComponent(email)}`,
      );
      return { success: true as const, data: res.data };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const createOrder = useCallback(async (email: string, billingCycle: string) => {
    try {
      const res = await apiClient.post<{ orderId: string; amountPaisa: number; currency: string; keyId: string; planName: string; billingCycle: string }>(
        '/registrations/create-order',
        { email, billingCycle },
      );
      return { success: true as const, data: res.data };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const completeRegistration = useCallback(async (email: string, gatewayOrderId: string, gatewayPaymentId: string, gatewaySignature: string) => {
    try {
      const res = await apiClient.post<{ accessToken: string; user: { id: string; email: string; firstName: string; lastName: string; role: string; organisationId: string } }>(
        '/registrations/complete',
        { email, gatewayOrderId, gatewayPaymentId, gatewaySignature },
      );
      return { success: true as const, data: res.data };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  return { register, verifyEmail, resendVerification, getDetails, createOrder, completeRegistration };
}
