import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: 'brand' | 'warning' | 'danger';
  className?: string;
  label?: string;
}

export function ProgressBar({ value, max = 100, tone, className, label }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const resolvedTone = tone ?? (percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : 'brand');

  const barColor = {
    brand: 'bg-brand-600',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
  }[resolvedTone];

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
