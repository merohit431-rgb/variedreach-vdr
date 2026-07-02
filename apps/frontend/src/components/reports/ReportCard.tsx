interface ReportCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}

export function ReportCard({ label, value, subtitle, loading }: ReportCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
      )}
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
