interface ReportCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}

export function ReportCard({ label, value, subtitle, loading }: ReportCardProps) {
  return (
    <div className="rounded-lg border border-app-border bg-app-s1 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-app-t3">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-app-s2" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold text-app-text">{value}</p>
      )}
      {subtitle && <p className="mt-0.5 text-xs text-app-t3">{subtitle}</p>}
    </div>
  );
}
