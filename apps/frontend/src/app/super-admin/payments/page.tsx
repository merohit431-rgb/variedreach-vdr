'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { CheckCircle2, Clock, XCircle, RefreshCcw } from 'lucide-react';

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: any; label: string }> = {
  SUCCESSFUL: { tone: 'success', icon: CheckCircle2, label: 'Successful' },
  PENDING:    { tone: 'warning', icon: Clock,        label: 'Pending' },
  FAILED:     { tone: 'danger',  icon: XCircle,      label: 'Failed' },
  REFUNDED:   { tone: 'neutral', icon: RefreshCcw,   label: 'Refunded' },
};

export default function PaymentsPage() {
  const { getPayments } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPayments(page, 25);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getPayments, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 25) : 1;
  const a = data?.analytics;

  const STAT_CARDS = a ? [
    { label: 'Successful', count: a.successful.count, total: a.successful.total, tone: 'emerald' },
    { label: 'Pending',    count: a.pending.count,    total: a.pending.total,    tone: 'amber' },
    { label: 'Failed',     count: a.failed.count,     total: a.failed.total,     tone: 'rose' },
    { label: 'Refunded',   count: a.refunded.count,   total: a.refunded.total,   tone: 'slate' },
  ] : [];

  const COLOR: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber:   'text-amber-700   bg-amber-50   border-amber-200',
    rose:    'text-rose-700    bg-rose-50    border-rose-200',
    slate:   'text-slate-700   bg-slate-50   border-slate-200',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
        <p className="mt-0.5 text-sm text-slate-500">All payment transactions across the platform.</p>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${COLOR[card.tone]}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.count}</p>
            <p className="mt-0.5 text-sm font-medium">{formatInr(card.total)}</p>
          </div>
        ))}
      </div>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Organisation</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Invoice</Th>
              <Th>Gateway ID</Th>
              <Th>Date</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={6} className="text-center py-8 text-slate-400">Loading…</Td></Tr>}
            {!loading && data?.items?.length === 0 && (
              <Tr><Td colSpan={6} className="text-center py-8 text-slate-400">No payments yet.</Td></Tr>
            )}
            {!loading && data?.items?.map((p: any) => {
              const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG['PENDING'];
              return (
                <Tr key={p.id}>
                  <Td>
                    <p className="font-medium text-slate-800">{p.organisation?.name ?? '—'}</p>
                  </Td>
                  <Td className="font-semibold text-slate-900">{formatInr(p.amountPaisa)}</Td>
                  <Td><Badge tone={cfg.tone} icon={cfg.icon}>{cfg.label}</Badge></Td>
                  <Td className="text-xs font-mono text-slate-500">{p.invoice?.invoiceNumber ?? '—'}</Td>
                  <Td className="text-xs font-mono text-slate-400 max-w-[140px] truncate">{p.gatewayPaymentId ?? '—'}</Td>
                  <Td className="text-slate-500 whitespace-nowrap">{formatDate(p.paidAt ?? p.createdAt)}</Td>
                </Tr>
              );
            })}
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
