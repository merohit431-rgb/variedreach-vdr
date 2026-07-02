'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  useReportSummary,
  useReportPreview,
  useDownloadTrends,
  downloadReport,
  ReportName,
  ReportExportFormat,
  StorageReportTable,
} from '@/hooks/use-reports';
import { formatBytes } from '@/lib/format';
import { ReportCard } from './ReportCard';
import { ReportDataTable } from './ReportDataTable';
import { TrendBarChart } from './TrendBarChart';
import { StorageSummaryCard } from './StorageSummaryCard';

type DatePreset = 'all' | '7d' | '30d' | '90d' | 'custom';
type Tab = 'overview' | 'downloads' | 'users' | 'storage';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'custom', label: 'Custom' },
];

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'users', label: 'Users' },
  { value: 'storage', label: 'Storage' },
];

const EXPORT_FORMATS: { value: ReportExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];

const TAB_REPORT_NAME: Partial<Record<Tab, ReportName>> = {
  downloads: 'download-activity',
  users: 'user-activity',
  storage: 'storage',
};

function subDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getFilters(preset: DatePreset, customFrom: string, customTo: string) {
  const today = new Date().toISOString().slice(0, 10);
  switch (preset) {
    case '7d':
      return { from: subDays(7), to: today };
    case '30d':
      return { from: subDays(30), to: today };
    case '90d':
      return { from: subDays(90), to: today };
    case 'custom':
      return {
        ...(customFrom ? { from: customFrom } : {}),
        ...(customTo ? { to: customTo } : {}),
      };
    default:
      return {};
  }
}

export function ReportsView({ dataRoomId }: { dataRoomId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isExporting, setIsExporting] = useState<ReportExportFormat | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filters = useMemo(
    () => getFilters(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const { data: summary, isLoading: summaryLoading } = useReportSummary(dataRoomId, filters);
  const { data: trends, isLoading: trendsLoading } = useDownloadTrends(dataRoomId, filters);

  const activeReportName = TAB_REPORT_NAME[activeTab];
  // Storage report is not date-filtered
  const reportFilters = activeReportName === 'download-activity' ? filters : {};
  const { data: reportTable, isLoading: tableLoading } = useReportPreview(
    dataRoomId,
    activeReportName ?? 'download-activity',
    reportFilters,
    activeReportName !== undefined,
  );

  const storageTable = reportTable as StorageReportTable | undefined;

  async function handleExport(format: ReportExportFormat) {
    if (!activeReportName) return;
    setIsExporting(format);
    setShowExportMenu(false);
    try {
      await downloadReport(dataRoomId, activeReportName, format, reportFilters);
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Analytics &amp; Reports</h2>

        {activeReportName && activeTab !== 'overview' && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={isExporting !== null}
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {isExporting ? 'Exporting…' : 'Export'}
              <span className="text-slate-400 text-xs">▾</span>
            </button>
            {showExportMenu && (
              <>
                {/* Click-outside backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {EXPORT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => handleExport(fmt.value)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Date preset row */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setDatePreset(preset.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              datePreset === preset.value
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ReportCard
          label="Total Files"
          value={summaryLoading ? '—' : (summary?.totalFiles.toLocaleString() ?? '0')}
          loading={summaryLoading}
        />
        <ReportCard
          label="Downloads"
          value={summaryLoading ? '—' : (summary?.totalDownloads.toLocaleString() ?? '0')}
          subtitle="in period"
          loading={summaryLoading}
        />
        <ReportCard
          label="Views"
          value={summaryLoading ? '—' : (summary?.totalViews.toLocaleString() ?? '0')}
          subtitle="in period"
          loading={summaryLoading}
        />
        <ReportCard
          label="Active Users"
          value={summaryLoading ? '—' : (summary?.activeUsers.toLocaleString() ?? '0')}
          subtitle="in period"
          loading={summaryLoading}
        />
        <ReportCard
          label="Storage Used"
          value={summaryLoading ? '—' : formatBytes(summary?.storageUsedBytes ?? '0')}
          subtitle={
            summary
              ? `${summary.storageUsedPercent}% of ${summary.storageLimitGb} GB`
              : undefined
          }
          loading={summaryLoading}
        />
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Overview tab ── */}
      {activeTab === 'overview' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Download &amp; View Activity</h3>
            <span className="text-xs text-slate-400">
              {datePreset === 'all' ? 'Last 30 days' : DATE_PRESETS.find((p) => p.value === datePreset)?.label}
            </span>
          </div>
          {trendsLoading ? (
            <div className="mt-4 h-24 animate-pulse rounded-md bg-slate-100" />
          ) : (
            <TrendBarChart data={trends ?? []} />
          )}
        </div>
      )}

      {/* ── Downloads tab ── */}
      {activeTab === 'downloads' && (
        <>
          {tableLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : !reportTable || reportTable.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center">
              <p className="text-sm font-medium text-slate-600">No download events in this period</p>
              <p className="mt-1 text-sm text-slate-400">Try expanding the date range.</p>
            </div>
          ) : (
            <ReportDataTable headers={reportTable.headers} rows={reportTable.rows} />
          )}
        </>
      )}

      {/* ── Users tab ── */}
      {activeTab === 'users' && (
        <>
          {tableLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : !reportTable || reportTable.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center">
              <p className="text-sm font-medium text-slate-600">No member activity recorded yet</p>
              <p className="mt-1 text-sm text-slate-400">Activity appears once members access the data room.</p>
            </div>
          ) : (
            <ReportDataTable headers={reportTable.headers} rows={reportTable.rows} />
          )}
        </>
      )}

      {/* ── Storage tab ── */}
      {activeTab === 'storage' && (
        <>
          {tableLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ) : storageTable?.summary ? (
            <div className="space-y-5">
              <StorageSummaryCard
                usedBytes={storageTable.summary.usedBytes}
                limitGb={storageTable.summary.limitGb}
                fileCount={storageTable.summary.fileCount}
                byType={storageTable.summary.byType}
              />
              {storageTable.rows.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Top Files by Size</h3>
                  <ReportDataTable
                    headers={storageTable.headers}
                    rows={storageTable.rows}
                    pageSize={10}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center">
              <p className="text-sm text-slate-400">No files uploaded yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
