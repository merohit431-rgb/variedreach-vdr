import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton animate-shimmer rounded-md', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
