'use client';

import { useState } from 'react';
import { Monitor, LogOut } from 'lucide-react';
import { useSessions, useRevokeSession, useRevokeOtherSessions } from '@/hooks/use-sessions';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function SessionsPanel() {
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(sessionId: string) {
    setError(null);
    try {
      await revokeSession.mutateAsync(sessionId);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleRevokeOthers() {
    setError(null);
    try {
      await revokeOthers.mutateAsync();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-app-t4">Loading…</p>;
  }

  const hasOtherSessions = (sessions ?? []).some((s) => !s.isCurrent);

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {(sessions ?? []).map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between rounded-lg border border-app-border bg-app-s1 p-4"
        >
          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-t3" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-app-text">
                {session.device}
                {session.isCurrent && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-app-primary/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                    This device
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-app-t4">
                {session.ipAddress ?? 'Unknown IP'} · {relativeTime(session.createdAt)}
              </p>
            </div>
          </div>
          {!session.isCurrent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRevoke(session.id)}
              isLoading={revokeSession.isPending}
              className="flex-shrink-0 text-red-400 hover:bg-red-500/10"
            >
              Log out
            </Button>
          )}
        </div>
      ))}

      {(sessions ?? []).length === 0 && <p className="text-sm text-app-t4">No active sessions found.</p>}

      {hasOtherSessions && (
        <div className="flex justify-end pt-1">
          <Button
            variant="secondary"
            onClick={handleRevokeOthers}
            isLoading={revokeOthers.isPending}
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Log out of all other devices
          </Button>
        </div>
      )}
    </div>
  );
}
