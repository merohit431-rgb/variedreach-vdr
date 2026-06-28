import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400',
          'transition-colors duration-150',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-100',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
