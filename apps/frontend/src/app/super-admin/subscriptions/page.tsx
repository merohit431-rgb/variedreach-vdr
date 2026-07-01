'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PAST_DUE: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral',
};

const FILTER_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Past Due', value: 'PAST_DUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Expired', value: 'EXPIRED' },
];

export default function SubscriptionsPage() {
  const { getSubscriptions } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getSubscriptions(page, 20, statusFilter || undefined);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getSubscriptions, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;
  const breakdown = data?.statusBreakdown ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Subscriptions</h1>
        <p className="mt-0.5 text-sm text-slate-500">All customer subscriptions and their billing status.</p>
      </div>

      {/* Status breakdown pills */}
      {Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(breakdown).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
              <span className="font-semibold text-slate-900">{String(count)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Organisation</Th>
              <Th>Plan</Th>
              <Th>Cycle</Th>
              <Th>Storage</Th>
              <Th>Status</Th>
              <Th>Period End</Th>
              <Th>Cancel at end?</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={7} className="text-center py-8 text-slate-400">Loading…</Td></Tr>}
            {!loading && data?.items?.length === 0 && (
              <Tr><Td colSpan={7} className="text-center py-8 text-slate-400">No subscriptions found.</Td></Tr>
            )}
            {!loading && data?.items?.map((sub: any) => (
              <Tr key={sub.id}>
                <Td>
                  <p className="font-medium text-slate-800">{sub.organisation?.name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{sub.organisation?.slug}</p>
                </Td>
                <Td><Badge tone="brand">{sub.planSlug}</Badge></Td>
                <Td className="text-slate-600 text-xs">{sub.billingCycle}</Td>
                <Td className="text-slate-600">{sub.storageGb} GB</Td>
                <Td><Badge tone={STATUS_TONE[sub.status] ?? 'neutral'}>{sub.status}</Badge></Td>
                <Td className="text-slate-500 whitespace-nowrap">{formatDate(sub.currentPeriodEnd)}</Td>
                <Td>{sub.cancelAtPeriodEnd ? <Badge tone="warning">Yes</Badge> : <span className="text-slate-400">No</span>}</Td>
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
