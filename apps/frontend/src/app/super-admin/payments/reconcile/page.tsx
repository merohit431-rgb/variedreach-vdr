'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SYNC_STATUS_CONFIG: Record<string, { tone: 'success' | 'warning' | 'neutral'; icon: typeof CheckCircle2; label: string }> = {
  IN_SYNC:     { tone: 'success', icon: CheckCircle2,  label: 'In sync' },
  DRIFTED:     { tone: 'warning', icon: AlertTriangle, label: 'Drifted' },
  NOT_CHECKED: { tone: 'neutral', icon: HelpCircle,    label: 'Not checked' },
};

interface ReconcileRow {
  id: string;
  amountPaisa: number;
  status: string;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  createdAt: string;
  organisation: { id: string; name: string } | null;
  invoiceNumber: string | null;
  subscription: { planSlug: string; billingCycle: string; status: string } | null;
  syncStatus: 'IN_SYNC' | 'DRIFTED' | 'NOT_CHECKED';
  lastCheckedAt: string | null;
  lastRazorpayStatus: string | null;
}

export default function ReconcilePage() {
  const { getPaymentsForReconciliation, reconcilePayment } = useSuperAdmin();
  const [data, setData] = useState<{ items: ReconcileRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPaymentsForReconciliation(page, 25);
    if (res.success) setData(res.data as { items: ReconcileRow[]; total: number });
    setLoading(false);
  }, [getPaymentsForReconciliation, page]);

  useEffect(() => { load(); }, [load]);

  async function handleReconcile(id: string) {
    setReconcilingId(id);
    setError(null);
    const res = await reconcilePayment(id);
    if (!res.success) {
      setError(res.message);
    }
    setReconcilingId(null);
    await load();
  }

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin/payments" className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Payments
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Reconcile</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Cross-check what we have on record against Razorpay directly. Checks run on demand, per row — nothing here calls Razorpay automatically.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Organisation</Th>
              <Th>Razorpay Order ID</Th>
              <Th>Payment ID</Th>
              <Th>Invoice</Th>
              <Th>Subscription</Th>
              <Th>Status</Th>
              <Th>Sync Status</Th>
              <Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={8} className="text-center py-8 text-slate-400">Loading…</Td></Tr>}
            {!loading && data?.items?.length === 0 && (
              <Tr><Td colSpan={8} className="text-center py-8 text-slate-400">No payments with a gateway order yet.</Td></Tr>
            )}
            {!loading && data?.items?.map((p) => {
              const syncCfg = SYNC_STATUS_CONFIG[p.syncStatus];
              const isReconciling = reconcilingId === p.id;
              return (
                <Tr key={p.id}>
                  <Td>
                    <p className="font-medium text-slate-800">{p.organisation?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
                  </Td>
                  <Td className="max-w-[160px] truncate font-mono text-xs text-slate-500">{p.gatewayOrderId ?? '—'}</Td>
                  <Td className="max-w-[160px] truncate font-mono text-xs text-slate-500">{p.gatewayPaymentId ?? '—'}</Td>
                  <Td className="text-xs font-mono text-slate-500">{p.invoiceNumber ?? '—'}</Td>
                  <Td className="text-xs text-slate-600">
                    {p.subscription ? `${p.subscription.planSlug} · ${p.subscription.billingCycle}` : '—'}
                  </Td>
                  <Td className="font-semibold text-slate-900">
                    {formatInr(p.amountPaisa)}
                    <span className="ml-1.5 text-xs font-normal text-slate-400">{p.status}</span>
                  </Td>
                  <Td>
                    <Badge tone={syncCfg.tone} icon={syncCfg.icon}>{syncCfg.label}</Badge>
                    {p.lastCheckedAt && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        checked {formatDate(p.lastCheckedAt)}
                        {p.lastRazorpayStatus && ` · razorpay: ${p.lastRazorpayStatus}`}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReconcile(p.id)}
                      disabled={isReconciling || !p.gatewayOrderId}
                    >
                      {isReconciling ? (
                        <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</span>
                      ) : (
                        'Reconcile with Razorpay'
                      )}
                    </Button>
                  </Td>
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
