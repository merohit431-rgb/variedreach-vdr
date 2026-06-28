import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/cn';

// Placeholder mark until the real Varied Reach logo file is provided -- swap
// the icon block below for an <Image src="/logo-mark.svg" ... /> at that
// point, the wordmark/subtitle layout stays the same either way.
function LogoMark({ className, variant }: { className?: string; variant: 'default' | 'light' }) {
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-lg',
        variant === 'light' ? 'bg-white/15 ring-1 ring-inset ring-white/30' : 'bg-gradient-to-br from-brand-600 to-accent-500',
        className,
      )}
    >
      <Globe2 className="h-[60%] w-[60%] text-white" strokeWidth={2} aria-hidden="true" />
    </div>
  );
}

interface LogoProps {
  size?: 'sm' | 'lg';
  showSubtitle?: boolean;
  iconOnly?: boolean;
  variant?: 'default' | 'light';
  className?: string;
}

export function Logo({
  size = 'sm',
  showSubtitle = false,
  iconOnly = false,
  variant = 'default',
  className,
}: LogoProps) {
  if (iconOnly) {
    return <LogoMark variant={variant} className={cn(size === 'lg' ? 'h-11 w-11' : 'h-8 w-8', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark variant={variant} className={size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'} />
      <div>
        <p
          className={cn(
            'font-bold italic leading-none tracking-tight',
            variant === 'light' ? 'text-white' : 'text-brand-700',
            size === 'lg' ? 'text-xl' : 'text-base',
          )}
        >
          VARIED REACH
        </p>
        {showSubtitle && (
          <p className={cn('mt-0.5 text-xs font-medium', variant === 'light' ? 'text-white/70' : 'text-slate-500')}>
            Virtual Data Room
          </p>
        )}
      </div>
    </div>
  );
}
