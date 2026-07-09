import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { extractErrorMessage } from '@/lib/error-message';

type Result<T> = { success: true; data: T } | { success: false; message: string };

async function get<T>(path: string): Promise<Result<T>> {
  try {
    const res = await apiClient.get<{ data: T }>(path);
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: extractErrorMessage(err) };
  }
}

async function patch<T>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await apiClient.patch<{ data: T }>(path, body);
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: extractErrorMessage(err) };
  }
}

async function post<T>(path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await apiClient.post<{ data: T }>(path, body ?? {});
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: extractErrorMessage(err) };
  }
}

async function del(path: string): Promise<Result<null>> {
  try {
    await apiClient.delete(path);
    return { success: true, data: null };
  } catch (err) {
    return { success: false, message: extractErrorMessage(err) };
  }
}

export function useSuperAdmin() {
  const getDashboard = useCallback(() => get('/super-admin/dashboard'), []);

  const getOrganisations = useCallback(
    (page = 1, limit = 20, search?: string, plan?: string) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (plan) params.set('plan', plan);
      return get(`/super-admin/organisations?${params}`);
    },
    [],
  );

  const getOrganisationById = useCallback(
    (id: string) => get(`/super-admin/organisations/${id}`),
    [],
  );

  const updateOrganisation = useCallback(
    (id: string, body: { userLimit?: number; storageLimitGb?: number; planSlug?: string }) =>
      patch(`/super-admin/organisations/${id}`, body),
    [],
  );

  const getRegistrations = useCallback(
    (page = 1, limit = 20) => get(`/super-admin/registrations?page=${page}&limit=${limit}`),
    [],
  );

  const getPayments = useCallback(
    (page = 1, limit = 20) => get(`/super-admin/payments?page=${page}&limit=${limit}`),
    [],
  );

  const refundPayment = useCallback((id: string) => post(`/super-admin/payments/${id}/refund`), []);

  const getPaymentsForReconciliation = useCallback(
    (page = 1, limit = 20) => get(`/super-admin/payments/reconcile?page=${page}&limit=${limit}`),
    [],
  );
  const reconcilePayment = useCallback((id: string) => post(`/super-admin/payments/${id}/reconcile`), []);

  const getSubscriptions = useCallback(
    (page = 1, limit = 20, status?: string) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      return get(`/super-admin/subscriptions?${params}`);
    },
    [],
  );

  const getInvoices = useCallback(
    (page = 1, limit = 20) => get(`/super-admin/invoices?page=${page}&limit=${limit}`),
    [],
  );

  const getRevenue = useCallback(() => get('/super-admin/revenue'), []);
  const getHealth = useCallback(() => get('/super-admin/health'), []);

  // Business profile (seller identity) — full record incl. PAN/GST.
  const getBusinessProfile = useCallback(() => get('/business-profile/admin'), []);
  const updateBusinessProfile = useCallback(
    (body: Record<string, string>) => patch('/business-profile', body),
    [],
  );

  // Coupons
  const getCoupons = useCallback(
    (search?: string) => get(`/coupons${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    [],
  );
  const getCoupon = useCallback((id: string) => get(`/coupons/${id}`), []);
  const createCoupon = useCallback((body: unknown) => post('/coupons', body), []);
  const updateCoupon = useCallback((id: string, body: unknown) => patch(`/coupons/${id}`, body), []);
  const deleteCoupon = useCallback((id: string) => del(`/coupons/${id}`), []);
  const duplicateCoupon = useCallback((id: string) => post(`/coupons/${id}/duplicate`), []);
  const getCouponRedemptions = useCallback((id: string) => get(`/coupons/${id}/redemptions`), []);

  const getActivity = useCallback(
    (page = 1, limit = 50) => get(`/super-admin/activity?page=${page}&limit=${limit}`),
    [],
  );

  return {
    getDashboard,
    getOrganisations,
    getOrganisationById,
    updateOrganisation,
    getRegistrations,
    getPayments,
    refundPayment,
    getPaymentsForReconciliation,
    reconcilePayment,
    getSubscriptions,
    getInvoices,
    getRevenue,
    getHealth,
    getActivity,
    getBusinessProfile,
    updateBusinessProfile,
    getCoupons,
    getCoupon,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    duplicateCoupon,
    getCouponRedemptions,
  };
}
