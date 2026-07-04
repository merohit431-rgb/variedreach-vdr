'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, ChevronLeft, LogOut, Menu, Search, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRooms } from '@/hooks/use-data-rooms';
import { useWorkspaceStore } from '@/store/workspace-store';
import { Avatar } from '@/components/ui/Avatar';
import { EnvironmentBadge } from '@/components/layout/EnvironmentBanner';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { ROLE_LABELS } from '@variedreach-vdr/shared';
import { cn } from '@/lib/cn';

const ROOM_PATH_PATTERN = /^\/data-rooms\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function RoomSwitcher({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { data: rooms } = useDataRooms();
  const resetWorkspace = useWorkspaceStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchRoom(id: string) {
    setOpen(false);
    if (id !== roomId) {
      resetWorkspace();
      router.push(`/data-rooms/${id}`);
    }
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-s2 px-3 py-1.5 text-xs font-medium text-app-t2 transition-colors hover:border-app-border2 hover:text-white"
      >
        All Data Rooms
        <ChevronDown className="h-3.5 w-3.5 text-app-t4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 max-h-80 w-72 animate-scale-in overflow-y-auto rounded-xl border border-app-border bg-app-s2 py-1.5 shadow-dark-popover"
        >
          {(rooms ?? []).map((room) => (
            <button
              key={room.id}
              role="menuitem"
              onClick={() => switchRoom(room.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-t2 transition-colors hover:bg-app-s3"
            >
              <span className="min-w-0 flex-1 truncate">{room.name}</span>
              {room.id === roomId && (
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-app-primary" aria-hidden="true" />
              )}
            </button>
          ))}
          <div className="my-1 border-t border-app-border" />
          <Link
            role="menuitem"
            href="/data-rooms"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-app-primary transition-colors hover:bg-app-s3"
          >
            View all data rooms
          </Link>
        </div>
      )}
    </div>
  );
}

function WorkspaceSearch({ roomId }: { roomId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { search, setSearch } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const filesPath = `/data-rooms/${roomId}`;

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  function handleChange(value: string) {
    setSearch(value);
    // Searching from another room tab jumps to the Files view where results render.
    if (value && pathname !== filesPath) router.push(filesPath);
  }

  return (
    <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-t4"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={search}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search files, folders or members…"
        className="w-full rounded-lg border border-app-border bg-app-s2 py-2 pl-9 pr-12 text-sm text-app-text placeholder:text-app-t4 focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-app-border bg-app-s3 px-1.5 py-0.5 text-[10px] font-semibold text-app-t4">
        ⌘K
      </kbd>
    </div>
  );
}

export function TopNav({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const roomId = pathname.match(ROOM_PATH_PATTERN)?.[1] ?? null;

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
    <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-app-border bg-app-s1/90 px-4 backdrop-blur-sm lg:px-6">
      {/* Left: hamburger (mobile) + room context or greeting */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className="rounded-md p-2 text-app-t3 hover:bg-app-s2 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {roomId ? (
          <div className="flex items-center gap-2">
            <Link
              href="/data-rooms"
              aria-label="Back to data rooms"
              className="hidden rounded-lg border border-app-border p-1.5 text-app-t4 transition-colors hover:border-app-border2 hover:text-app-t2 sm:block"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <RoomSwitcher roomId={roomId} />
          </div>
        ) : (
          user && (
            <p className="hidden truncate text-sm font-semibold text-app-t2 sm:block">
              {getGreeting()}, {user.firstName}.
            </p>
          )
        )}
      </div>

      {/* Center: workspace search inside a room */}
      {roomId ? <WorkspaceSearch roomId={roomId} /> : <div className="flex-1" />}
      {roomId && <div className="hidden flex-1 md:hidden" />}

      {/* Right: env badge + bell + avatar */}
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        <EnvironmentBadge />

        <ThemeToggle />

        {user && <NotificationBell />}

        {user && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-app-s2"
            >
              <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
              <span className="hidden text-app-t2 sm:inline">{ROLE_LABELS[user.role]}</span>
              <ChevronDown className="h-3.5 w-3.5 text-app-t4" />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 animate-scale-in rounded-xl border border-app-border bg-app-s2 py-1.5 shadow-dark-popover"
              >
                <div className="border-b border-app-border px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-app-text">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-app-t4">{user.email}</p>
                </div>
                <Link
                  role="menuitem"
                  href="/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-t2 hover:bg-app-s3"
                >
                  <Settings className="h-4 w-4 text-app-t4" />
                  Settings
                </Link>
                <div className="my-1 border-t border-app-border" />
                <button
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-t2 hover:bg-app-s3"
                >
                  <LogOut className="h-4 w-4 text-app-t4" />
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
