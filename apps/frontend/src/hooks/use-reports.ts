import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ReportName = 'download-activity' | 'user-activity';
export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface ReportFilters {
  from?: string;
  to?: string;
}

export function useReportPreview(dataRoomId: string, reportName: ReportName, filters: ReportFilters) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'reports', reportName, filters],
    queryFn: async () => {
      const response = await apiClient.get<{ data: ReportTable }>(
        `/data-rooms/${dataRoomId}/reports/${reportName}`,
        { params: { ...filters, format: 'json' } },
      );
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
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
