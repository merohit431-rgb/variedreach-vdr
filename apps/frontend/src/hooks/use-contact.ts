import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { extractErrorMessage } from '@/lib/error-message';

export interface DemoRequestInput {
  fullName: string;
  firmName: string;
  workEmail: string;
  phone: string;
  role?: string;
  useCase: string;
  preferredDate?: string;
  preferredSlot?: string;
  message?: string;
  website?: string; // honeypot
}

export interface CallbackRequestInput {
  fullName: string;
  phone: string;
  bestTime: string;
  website?: string; // honeypot
}

export function useContact() {
  const requestDemo = useCallback(async (input: DemoRequestInput) => {
    try {
      const res = await apiClient.post<{ received: boolean }>('/contact/demo', input);
      return { success: true as const, received: res.data.received };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  const requestCallback = useCallback(async (input: CallbackRequestInput) => {
    try {
      const res = await apiClient.post<{ received: boolean }>('/contact/callback', input);
      return { success: true as const, received: res.data.received };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  return { requestDemo, requestCallback };
}
