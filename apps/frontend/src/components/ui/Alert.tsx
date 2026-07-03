import { HTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
}

const TONE_CONFIG = {
  info: {
    icon: Info,
    classes:
      'bg-brand-50 text-brand-700 border-brand-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  },
  success: {
    icon: CheckCircle2,
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    classes:
      'bg-amber-50 text-amber-700 border-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  },
  danger: {
    icon: XCircle,
    classes:
      'bg-rose-50 text-rose-700 border-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  },
} satisfies Record<AlertTone, { icon: typeof Info; classes: string }>;

export function Alert({ className, tone = 'info', children, ...props }: AlertProps) {
  const { icon: Icon, classes } = TONE_CONFIG[tone];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        tone === 'success' && 'animate-scale-in',
        classes,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
