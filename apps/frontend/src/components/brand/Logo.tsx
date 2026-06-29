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
  size?: 'sm' | 'lg' | 'xl';
  showSubtitle?: boolean;
  iconOnly?: boolean;
  variant?: 'default' | 'light';
  className?: string;
}

const MARK_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-8 w-8',
  lg: 'h-11 w-11',
  xl: 'h-[3.25rem] w-[3.25rem]',
};

const WORDMARK_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

const SUBTITLE_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-xs',
  lg: 'text-xs',
  xl: 'text-sm',
};

export function Logo({
  size = 'sm',
  showSubtitle = false,
  iconOnly = false,
  variant = 'default',
  className,
}: LogoProps) {
  if (iconOnly) {
    return <LogoMark variant={variant} className={cn(MARK_SIZE[size], className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark variant={variant} className={MARK_SIZE[size]} />
      <div>
        <p
          className={cn(
            'font-bold italic leading-none tracking-tight',
            variant === 'light' ? 'text-white' : 'text-brand-700',
            WORDMARK_SIZE[size],
          )}
        >
          VARIED REACH
        </p>
        {showSubtitle && (
          <p
            className={cn(
              'mt-0.5 font-medium',
              variant === 'light' ? 'text-white/70' : 'text-slate-500',
              SUBTITLE_SIZE[size],
            )}
          >
            Virtual Data Room
          </p>
        )}
      </div>
    </div>
  );
}
