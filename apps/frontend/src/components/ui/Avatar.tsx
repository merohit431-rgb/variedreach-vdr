import { cn } from '@/lib/cn';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

export function Avatar({
  name,
  className,
  size = 'md',
}: {
  name: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
