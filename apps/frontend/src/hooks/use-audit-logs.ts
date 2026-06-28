import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AuditLogEntry {
  id: string;
  dataRoomId: string | null;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useAuditLogs(dataRoomId: string, filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'audit-logs', filters],
    queryFn: async () => {
      const response = await apiClient.get<{
        data: AuditLogEntry[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(`/data-rooms/${dataRoomId}/audit-logs`, { params: filters });
      return response.data;
    },
    enabled: Boolean(dataRoomId),
  });
}
