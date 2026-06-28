import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DashboardStats {
  activeDataRooms: number;
  totalUsers: number;
  storage: {
    usedBytes: number;
    usedGb: number;
    limitGb: number;
    percentUsed: number;
  };
}

export interface ActivityItem {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
  dataRoom: { name: string } | null;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DashboardStats }>('/dashboard/stats');
      return response.data.data;
    },
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: async () => {
      const response = await apiClient.get<{ data: ActivityItem[] }>('/dashboard/activity', {
        params: { limit },
      });
      return response.data.data;
    },
  });
}
