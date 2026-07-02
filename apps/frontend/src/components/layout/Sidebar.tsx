'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
  LayoutDashboard,
  FolderLock,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAuthStore } from '@/store/auth-store';
import { ROLE_LABELS, EXTERNAL_ROLES, type UserRole } from '@variedreach-vdr/shared';
import { cn } from '@/lib/cn';

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavSection = { label?: string; items: NavItem[] };

function getNavSections(role: UserRole): NavSection[] {
  const isExternal = EXTERNAL_ROLES.includes(role);

  if (isExternal) {
    return [
      {
        items: [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/data-rooms', label: 'My Assignments', icon: FolderLock },
        ],
      },
    ];
  }

  const sections: NavSection[] = [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/data-rooms', label: 'Data Rooms', icon: FolderLock },
      ],
    },
  ];

  if (role === 'ORG_ADMIN') {
    sections.push({
      label: 'Administration',
      items: [{ href: '/roles', label: 'Roles & Permissions', icon: ShieldCheck }],
    });
  }

  return sections;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const sections = user ? getNavSections(user.role) : getNavSections('RP_LIQUIDATOR');

  const content = (
    <>
      {/* Logo header */}
      <div
        className={cn(
          'flex h-16 flex-shrink-0 items-center border-b border-slate-100',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        <Logo size="sm" showSubtitle={!isCollapsed} iconOnly={isCollapsed} />
        <button
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : undefined}>
            {!isCollapsed && section.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {section.label}
              </p>
            )}
            {isCollapsed && si > 0 && <div className="mb-3 mt-1 mx-3 border-t border-slate-100" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isCollapsed && 'justify-center px-0 py-2.5',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-600" />
                    )}
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] flex-shrink-0',
                        isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600',
                      )}
                      aria-hidden="true"
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                return (
                  <div key={item.href}>
                    {isCollapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info + collapse toggle */}
      <div className="flex-shrink-0 border-t border-slate-100 p-3">
        {user && !isCollapsed && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-700">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[10px] text-slate-400">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
        )}
        {user && isCollapsed && (
          <div className="mb-2 flex justify-center">
            <Tooltip label={`${user.firstName} ${user.lastName} — ${ROLE_LABELS[user.role]}`}>
              <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            </Tooltip>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 lg:flex',
            isCollapsed && 'justify-center',
          )}
        >
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!isCollapsed && 'Collapse'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden h-screen flex-shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex',
          isCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {content}
      </aside>

      {/* Mobile off-canvas drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-popover animate-slide-up">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
