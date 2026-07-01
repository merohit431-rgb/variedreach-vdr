'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { CheckCircle2, Clock, XCircle, ArrowUpRight } from 'lucide-react';

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function funnelWidth(n: number, total: number) {
  if (!total) return '0%';
  return `${Math.max(4, Math.round((n / total) * 100))}%`;
}

export default function RegistrationsPage() {
  const { getRegistrations } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getRegistrations(page, 20);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getRegistrations, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;
  const funnel = data?.funnel;

  const STEPS = funnel ? [
    { label: 'Registration started', value: funnel.started, color: 'bg-brand-500' },
    { label: 'Email verified', value: funnel.emailVerified, color: 'bg-violet-500' },
    { label: 'Checkout reached', value: funnel.checkoutReached, color: 'bg-amber-500' },
    { label: 'Payment successful', value: funnel.paymentSuccessful, color: 'bg-emerald-500' },
    { label: 'Provisioned', value: funnel.provisioned, color: 'bg-teal-600' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Registrations</h1>
        <p className="mt-0.5 text-sm text-slate-500">Sign-up funnel analytics and registration details.</p>
      </div>

      {/* Funnel */}
      {funnel && (
        <Card>
          <CardHeader><CardTitle>Registration Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {STEPS.map((step) => (
              <div key={step.label} className="flex items-center gap-4">
                <span className="w-40 flex-shrink-0 text-sm text-slate-600">{step.label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${step.color} transition-all`}
                    style={{ width: funnelWidth(step.value, funnel.started) }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-semibold text-slate-900">{step.value}</span>
                <span className="w-12 text-right text-xs text-slate-400">
                  {funnel.started ? `${Math.round((step.value / funnel.started) * 100)}%` : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">All Registrations {data && `(${data.total})`}</h2>
      </div>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Company / Email</Th>
              <Th>Plan</Th>
              <Th>Billing</Th>
              <Th>Started</Th>
              <Th>Verified</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={6} className="text-center py-8 text-slate-400">Loading…</Td></Tr>}
            {!loading && data?.data?.length === 0 && (
              <Tr><Td colSpan={6} className="text-center py-8 text-slate-400">No registrations yet.</Td></Tr>
            )}
            {!loading && data?.data?.map((reg: any) => (
              <Tr key={reg.id}>
                <Td>
                  <p className="font-medium text-slate-800">{reg.companyName}</p>
                  <p className="text-xs text-slate-400">{reg.email}</p>
                </Td>
                <Td><Badge tone="brand">{reg.selectedPlan}</Badge></Td>
                <Td className="text-slate-600 text-xs">{reg.billingCycle}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">{formatDate(reg.createdAt)}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">{formatDate(reg.verifiedAt)}</Td>
                <Td>
                  {reg.provisionedAt ? (
                    <Badge tone="success" icon={CheckCircle2}>Active</Badge>
                  ) : reg.paymentStatus === 'COMPLETED' ? (
                    <Badge tone="warning" icon={Clock}>Provisioning</Badge>
                  ) : reg.gatewayOrderId ? (
                    <Badge tone="neutral" icon={ArrowUpRight}>Order created</Badge>
                  ) : reg.verifiedAt ? (
                    <Badge tone="neutral" icon={ArrowUpRight}>Verified</Badge>
                  ) : (
                    <Badge tone="danger" icon={XCircle}>Unverified</Badge>
                  )}
                </Td>
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
