import { formatBytes } from '@/lib/format';

interface StorageSummaryCardProps {
  usedBytes: string;
  limitGb: number;
  fileCount: number;
  byType: Record<string, string>;
}

const TYPE_COLORS: Record<string, string> = {
  PDF: 'bg-red-500',
  Images: 'bg-blue-500',
  Documents: 'bg-green-500',
  Other: 'bg-slate-400',
};

export function StorageSummaryCard({ usedBytes, limitGb, fileCount, byType }: StorageSummaryCardProps) {
  const usedNum = Number(usedBytes);
  const limitNum = limitGb * 1024 * 1024 * 1024;
  const pct = limitNum > 0 ? Math.min(100, (usedNum / limitNum) * 100) : 0;
  const totalTypeBytes = Object.values(byType).reduce((s, v) => s + Number(v), 0);

  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-900';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Storage Usage</p>
          <p className="mt-0.5 text-xs text-slate-500">{fileCount} files total</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900">{formatBytes(usedBytes)}</p>
          <p className="text-xs text-slate-500">of {limitGb} GB quota</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 overflow-hidden rounded-full bg-slate-100" style={{ height: 8 }}>
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <p className="mb-4 text-right text-xs text-slate-500">{pct.toFixed(1)}% used</p>

      {/* Type breakdown */}
      {Object.keys(byType).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">By file type</p>
          <div className="space-y-1.5">
            {Object.entries(byType)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([type, bytes]) => {
                const typePct = totalTypeBytes > 0 ? (Number(bytes) / totalTypeBytes) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${TYPE_COLORS[type] ?? 'bg-slate-400'}`}
                    />
                    <span className="w-20 flex-shrink-0 text-xs text-slate-600">{type}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 4 }}>
                      <div
                        className={`h-full rounded-full ${TYPE_COLORS[type] ?? 'bg-slate-400'}`}
                        style={{ width: `${typePct.toFixed(1)}%` }}
                      />
                    </div>
                    <span className="w-16 flex-shrink-0 text-right text-xs text-slate-500">
                      {formatBytes(bytes)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
