'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  description?: string;
}

export function StatCard({ label, value, icon: Icon, iconColor, iconBg, description }: StatCardProps) {
  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-t3">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-app-text">{value}</p>
          {description && <p className="mt-0.5 text-xs text-app-t3">{description}</p>}
        </div>
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  );
}
