'use client';

import Link from 'next/link';
import { type LucideIcon, Plus, FolderLock, Users, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { EXTERNAL_ROLES } from '@variedreach-vdr/shared';
import { cn } from '@/lib/cn';

type Action = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  primary?: boolean;
};

const ADMIN_ACTIONS: Action[] = [
  {
    href: '/data-rooms/new',
    label: 'Create Data Room',
    description: 'Start a new CIRP or M&A room',
    icon: Plus,
    primary: true,
  },
  {
    href: '/data-rooms',
    label: 'View Data Rooms',
    description: 'Browse all active rooms',
    icon: FolderLock,
  },
  {
    href: '/roles',
    label: 'Manage Access',
    description: 'Roles & permissions',
    icon: Users,
  },
];

const EXTERNAL_ACTIONS: Action[] = [
  {
    href: '/data-rooms',
    label: 'My Assignments',
    description: 'View your data rooms',
    icon: FolderLock,
    primary: true,
  },
];

export function QuickActions() {
  const { user } = useAuthStore();
  const isExternal = user ? EXTERNAL_ROLES.includes(user.role) : false;
  const actions = isExternal ? EXTERNAL_ACTIONS : ADMIN_ACTIONS;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick Actions</p>
      <div className="mt-4 space-y-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              action.primary
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'border border-slate-200 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
                action.primary ? 'bg-white/15' : 'bg-slate-100 group-hover:bg-slate-200',
              )}
            >
              <action.icon
                className={cn('h-4 w-4', action.primary ? 'text-white' : 'text-slate-500')}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', action.primary ? 'text-white' : 'text-slate-800')}>
                {action.label}
              </p>
              <p className={cn('text-xs', action.primary ? 'text-white/70' : 'text-slate-400')}>
                {action.description}
              </p>
            </div>
            <ArrowRight
              className={cn(
                'h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
                action.primary ? 'text-white' : 'text-slate-400',
              )}
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
