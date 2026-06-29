'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AuditActionType } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';
import { NotAuthorized } from '@/components/shared/NotAuthorized';

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
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{extractErrorMessage(error)}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="action-filter" className="block text-xs font-medium text-slate-700">
            Action
          </label>
          <select
            id="action-filter"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditActionType | '');
              resetToFirstPage();
            }}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
          <label htmlFor="from-filter" className="block text-xs font-medium text-slate-700">
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
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to-filter" className="block text-xs font-medium text-slate-700">
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
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading activity…</p>
      ) : !data || data.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No activity matches these filters.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-slate-600">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {AUDIT_ACTION_LABELS[entry.action as AuditActionType] ?? entry.action}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{describeResource(entry)}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>
              Page {data.meta.page} of {Math.max(1, data.meta.totalPages)} · {data.meta.total} events
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
