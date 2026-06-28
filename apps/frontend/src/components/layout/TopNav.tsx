'use client';

import { useAuth } from '@/hooks/use-auth';

export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={logout}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
