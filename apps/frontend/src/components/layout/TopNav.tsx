'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, Menu, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar } from '@/components/ui/Avatar';
import { EnvironmentBadge } from '@/components/layout/EnvironmentBanner';
import { NotificationBell } from '@/components/layout/NotificationBell';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function TopNav({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm lg:px-6">
      {/* Left: hamburger (mobile) + greeting (desktop) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {user && (
          <p className="hidden text-sm font-semibold text-slate-800 sm:block">
            {getGreeting()}, {user.firstName}.
          </p>
        )}
      </div>

      {/* Right: env badge + bell + avatar */}
      <div className="flex items-center gap-2">
        <EnvironmentBadge />

        {user && <NotificationBell />}

        {user && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-slate-50"
            >
              <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
              <span className="hidden text-slate-700 sm:inline">{user.firstName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-52 animate-scale-in rounded-xl border border-slate-200 bg-white py-1.5 shadow-popover"
              >
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-400">{user.email}</p>
                </div>
                <Link
                  role="menuitem"
                  href="/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  Settings
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <button
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4 text-slate-400" />
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
