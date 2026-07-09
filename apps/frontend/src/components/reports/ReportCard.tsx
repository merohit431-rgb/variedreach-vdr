interface ReportCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}

export function ReportCard({ label, value, subtitle, loading }: ReportCardProps) {
  return (
    <div className="rounded-lg border border-app-border bg-app-s1 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-app-t3">{label}</p>
        {subtitle && <p className="flex-shrink-0 truncate text-[10px] text-app-t4">{subtitle}</p>}
      </div>
      {loading ? (
        <div className="mt-1 h-5 w-16 animate-pulse rounded bg-app-s2" />
      ) : (
        <p className="mt-0.5 truncate text-lg font-semibold leading-tight text-app-text">{value}</p>
      )}
    </div>
  );
}
