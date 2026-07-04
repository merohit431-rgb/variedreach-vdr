'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { extractErrorMessage } from '@/lib/error-message';

export interface CouponResult {
  valid: boolean;
  reason?: string;
  code?: string;
  type?: 'PERCENT' | 'FIXED';
  discountPaisa: number;
  finalPaisa: number;
}

export interface ValidateCouponInput {
  code: string;
  planId: string;
  storageGb: number;
  billingCycle?: string;
  email?: string;
}

export function useCoupon() {
  const validate = useCallback(async (input: ValidateCouponInput) => {
    try {
      const res = await apiClient.post<{ data: CouponResult }>('/coupons/validate', input);
      return { success: true as const, data: res.data.data };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  return { validate };
}
