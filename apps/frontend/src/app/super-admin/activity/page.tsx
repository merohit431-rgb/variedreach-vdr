'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Colour-code audit actions by category
function actionTone(action: string): 'success' | 'danger' | 'warning' | 'neutral' | 'brand' {
  if (action.includes('DELETED') || action.includes('REMOVED') || action.includes('REVOKED')) return 'danger';
  if (action.includes('CREATED') || action.includes('ACCEPTED') || action.includes('UPLOADED')) return 'success';
  if (action.includes('LOGIN') || action.includes('LOGOUT') || action.includes('PASSWORD')) return 'warning';
  if (action.includes('VIEWED') || action.includes('DOWNLOADED')) return 'brand';
  return 'neutral';
}

export default function ActivityPage() {
  const { getActivity } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getActivity(page, 50);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getActivity, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Activity Log</h1>
          <p className="mt-0.5 text-sm text-slate-500">Platform-wide audit log across all organisations and users.</p>
        </div>
        {data && <span className="text-sm text-slate-500">{data.total.toLocaleString()} events</span>}
      </div>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Action</Th>
              <Th>User</Th>
              <Th>Resource</Th>
              <Th>IP Address</Th>
              <Th>Timestamp</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={5} className="text-center py-8 text-slate-400">Loading…</Td></Tr>}
            {!loading && data?.items?.length === 0 && (
              <Tr><Td colSpan={5} className="text-center py-8 text-slate-400">No activity recorded yet.</Td></Tr>
            )}
            {!loading && data?.items?.map((log: any) => (
              <Tr key={log.id}>
                <Td>
                  <Badge tone={actionTone(log.action)} className="font-mono text-[11px]">{log.action}</Badge>
                </Td>
                <Td>
                  {log.user ? (
                    <div>
                      <p className="text-sm font-medium text-slate-800">{log.user.firstName} {log.user.lastName}</p>
                      <p className="text-xs text-slate-400">{log.user.email}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">System</span>
                  )}
                </Td>
                <Td>
                  {log.resourceType && (
                    <div>
                      <p className="text-xs text-slate-600">{log.resourceType}</p>
                      <p className="text-xs font-mono text-slate-400 truncate max-w-[120px]">{log.resourceId ?? '—'}</p>
                    </div>
                  )}
                </Td>
                <Td className="text-xs font-mono text-slate-500">{log.ipAddress ?? '—'}</Td>
                <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      )}
    </div>
  );
}
