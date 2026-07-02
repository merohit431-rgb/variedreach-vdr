import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ReportName = 'download-activity' | 'user-activity' | 'storage';
export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface StorageReportTable extends ReportTable {
  summary: {
    usedBytes: string;
    limitGb: number;
    fileCount: number;
    byType: Record<string, string>;
  };
}

export interface SummaryStats {
  totalFiles: number;
  totalDownloads: number;
  totalViews: number;
  totalUploads: number;
  activeUsers: number;
  storageUsedBytes: string;
  storageLimitGb: number;
  storageUsedPercent: number;
}

export interface TrendPoint {
  date: string;
  downloads: number;
  views: number;
}

export interface ReportFilters {
  from?: string;
  to?: string;
}

export function useReportSummary(dataRoomId: string, filters: ReportFilters) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'reports', 'summary', filters],
    queryFn: async () => {
      const response = await apiClient.get<{ data: SummaryStats }>(
        `/data-rooms/${dataRoomId}/reports/summary`,
        { params: { ...filters } },
      );
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useDownloadTrends(dataRoomId: string, filters: ReportFilters) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'reports', 'download-trends', filters],
    queryFn: async () => {
      const response = await apiClient.get<{ data: TrendPoint[] }>(
        `/data-rooms/${dataRoomId}/reports/download-trends`,
        { params: { ...filters } },
      );
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useReportPreview(
  dataRoomId: string,
  reportName: ReportName,
  filters: ReportFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'reports', reportName, filters],
    queryFn: async () => {
      const response = await apiClient.get<{ data: ReportTable | StorageReportTable }>(
        `/data-rooms/${dataRoomId}/reports/${reportName}`,
        { params: { ...filters, format: 'json' } },
      );
      return response.data.data;
    },
    enabled: enabled && Boolean(dataRoomId),
  });
}

export async function downloadReport(
  dataRoomId: string,
  reportName: ReportName,
  format: ReportExportFormat,
  filters: ReportFilters,
) {
  const response = await apiClient.get<Blob>(`/data-rooms/${dataRoomId}/reports/${reportName}`, {
    params: { ...filters, format },
    responseType: 'blob',
  });

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportName}-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
