'use client';

import { useState } from 'react';
import { useReportPreview, downloadReport, ReportName, ReportExportFormat } from '@/hooks/use-reports';

const REPORTS: { value: ReportName; label: string; hasDateRange: boolean }[] = [
  { value: 'download-activity', label: 'Download Activity Report', hasDateRange: true },
  { value: 'user-activity', label: 'User Activity Report', hasDateRange: false },
];

const EXPORT_FORMATS: { value: ReportExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];

export function ReportsView({ dataRoomId }: { dataRoomId: string }) {
  const [reportName, setReportName] = useState<ReportName>('download-activity');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isExporting, setIsExporting] = useState<ReportExportFormat | null>(null);

  const activeReport = REPORTS.find((r) => r.value === reportName)!;
  const filters = activeReport.hasDateRange ? { from: from || undefined, to: to || undefined } : {};
  const { data: table, isLoading } = useReportPreview(dataRoomId, reportName, filters);

  async function handleExport(format: ReportExportFormat) {
    setIsExporting(format);
    try {
      await downloadReport(dataRoomId, reportName, format, filters);
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="report-select" className="block text-xs font-medium text-slate-700">
            Report
          </label>
          <select
            id="report-select"
            value={reportName}
            onChange={(e) => setReportName(e.target.value as ReportName)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {REPORTS.map((report) => (
              <option key={report.value} value={report.value}>
                {report.label}
              </option>
            ))}
          </select>
        </div>

        {activeReport.hasDateRange && (
          <>
            <div>
              <label htmlFor="report-from" className="block text-xs font-medium text-slate-700">
                From
              </label>
              <input
                id="report-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="report-to" className="block text-xs font-medium text-slate-700">
                To
              </label>
              <input
                id="report-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </>
        )}

        <div className="ml-auto flex gap-2">
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              onClick={() => handleExport(fmt.value)}
              disabled={isExporting !== null}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isExporting === fmt.value ? 'Exporting…' : `Export ${fmt.label}`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading report…</p>
      ) : !table || table.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No data for this report yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {table.headers.map((header) => (
                  <th key={header} className="whitespace-nowrap px-4 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
