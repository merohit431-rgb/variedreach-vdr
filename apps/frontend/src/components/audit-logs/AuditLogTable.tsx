'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AuditActionType } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';
import { NotAuthorized } from '@/components/shared/NotAuthorized';
import { Skeleton } from '@/components/ui/Skeleton';

function describeResource(entry: { resourceType: string | null; metadata: Record<string, unknown> | null }) {
  if (!entry.resourceType) return '—';
  const name = entry.metadata && typeof entry.metadata.name === 'string' ? entry.metadata.name : null;
  return name ? `${entry.resourceType} · ${name}` : entry.resourceType;
}

export function AuditLogTable({ dataRoomId }: { dataRoomId: string }) {
  const [action, setAction] = useState<AuditActionType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAuditLogs(dataRoomId, {
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: 50,
  });

  function resetToFirstPage() {
    setPage(1);
  }

  if (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      // Only reachable for actual non-members now — external-but-member
      // roles get a scoped 200 (their own activity) from the backend,
      // never a 403, so this is a real "you're not in this room" case.
      return <NotAuthorized description="You don't have access to this data room's activity." />;
    }
    return <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{extractErrorMessage(error)}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
        <div>
          <label htmlFor="action-filter" className="block text-xs font-medium text-app-t2">
            Action
          </label>
          <select
            id="action-filter"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditActionType | '');
              resetToFirstPage();
            }}
            className="mt-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-sm text-app-text focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from-filter" className="block text-xs font-medium text-app-t2">
            From
          </label>
          <input
            id="from-filter"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetToFirstPage();
            }}
            className="mt-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-sm text-app-text focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
          />
        </div>
        <div>
          <label htmlFor="to-filter" className="block text-xs font-medium text-app-t2">
            To
          </label>
          <input
            id="to-filter"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetToFirstPage();
            }}
            className="mt-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-sm text-app-text focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-app-border bg-app-s1 px-4 py-3">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border2 p-8 text-center text-sm text-app-t3">
          No activity matches these filters.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-app-border bg-app-s2/60 text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Time</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">User</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Action</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">Resource</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {data.data.map((entry, i) => (
                  <tr key={entry.id} className={i % 2 === 0 ? 'bg-app-s1' : 'bg-app-s2/40'}>
                    <td className="px-4 py-3 text-app-t3">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-app-text">
                      {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'}
                    </td>
                    <td className="px-4 py-3 text-app-t2">
                      {AUDIT_ACTION_LABELS[entry.action as AuditActionType] ?? entry.action}
                    </td>
                    <td className="px-4 py-3 text-app-t2">{describeResource(entry)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-app-t3">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-app-t3">
              Page {data.meta.page} of {Math.max(1, data.meta.totalPages)} · {data.meta.total} events
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-app-border bg-app-s1 px-3 py-1.5 text-xs font-medium text-app-t2 hover:bg-app-s2 disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-lg border border-app-border bg-app-s1 px-3 py-1.5 text-xs font-medium text-app-t2 hover:bg-app-s2 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
