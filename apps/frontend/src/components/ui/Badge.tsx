import { HTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: LucideIcon;
}

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-app-s2 text-app-t2',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-rose-500/10 text-rose-300',
  brand: 'bg-app-primary/10 text-blue-300',
};

export function Badge({ className, tone = 'neutral', icon: Icon, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
