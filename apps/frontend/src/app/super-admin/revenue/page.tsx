'use client';

import { useEffect, useState } from 'react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

function formatInr(paise: number) {
  const inr = paise / 100;
  if (inr >= 1_00_000) return `₹${(inr / 1_00_000).toFixed(2)}L`;
  if (inr >= 1_000) return `₹${(inr / 1_000).toFixed(1)}K`;
  return `₹${inr.toFixed(0)}`;
}

function formatInrFull(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export default function RevenuePage() {
  const { getRevenue } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRevenue().then((res) => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, [getRevenue]);

  if (loading) return <div className="h-64 rounded-xl bg-slate-200 animate-pulse" />;
  if (!data) return <p className="text-sm text-rose-600">Failed to load revenue data.</p>;

  const { monthly, byPlan, summary } = data;
  const maxRevenue = Math.max(...monthly.map((m: any) => m.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Revenue</h1>
        <p className="mt-0.5 text-sm text-slate-500">Revenue analytics and trends for the last 12 months.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'All-time Revenue', value: formatInrFull(summary.totalRevenue) },
          { label: 'MRR (current)', value: formatInrFull(summary.mrr) },
          { label: 'ARR (projected)', value: formatInrFull(summary.arr) },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value || '₹0.00'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly chart (bar-style) */}
      <Card>
        <CardHeader><CardTitle>Monthly Revenue (last 12 months)</CardTitle></CardHeader>
        <CardContent>
          {monthly.every((m: any) => m.revenue === 0) ? (
            <p className="text-sm text-slate-400 py-4 text-center">No revenue recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {monthly.map((m: any) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-12 flex-shrink-0 text-xs text-slate-500 text-right">{monthLabel(m.month)}</span>
                  <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                    <div
                      className="h-5 bg-brand-500 rounded transition-all flex items-center pl-2"
                      style={{ width: `${Math.max(2, (m.revenue / maxRevenue) * 100)}%` }}
                    >
                      {m.revenue > maxRevenue * 0.15 && (
                        <span className="text-xs text-white font-medium">{formatInr(m.revenue)}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-20 flex-shrink-0 text-xs text-slate-600 text-right">{formatInr(m.revenue)}</span>
                  <span className="w-16 flex-shrink-0 text-xs text-slate-400 text-right">{m.count} txn{m.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by plan */}
      <Card>
        <CardHeader><CardTitle>MRR by Plan</CardTitle></CardHeader>
        <CardContent>
          {byPlan.length === 0 ? (
            <p className="text-sm text-slate-400">No active subscriptions.</p>
          ) : (
            <TableContainer className="border-0 shadow-none rounded-none">
              <Table>
                <Thead><tr><Th>Plan</Th><Th>Organisations</Th><Th>Monthly Revenue</Th><Th>% of MRR</Th></tr></Thead>
                <Tbody>
                  {byPlan.map((p: any) => (
                    <Tr key={p.planSlug}>
                      <Td><Badge tone="brand">{p.planSlug}</Badge></Td>
                      <Td className="text-slate-700">{p.count}</Td>
                      <Td className="font-semibold text-slate-900">{formatInrFull(p.mrr)}</Td>
                      <Td className="text-slate-500">
                        {summary.mrr ? `${Math.round((p.mrr / summary.mrr) * 100)}%` : '—'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly detail table */}
      <Card>
        <CardHeader><CardTitle>Monthly Detail</CardTitle></CardHeader>
        <TableContainer className="border-0 shadow-none rounded-none">
          <Table>
            <Thead><tr><Th>Month</Th><Th>Revenue</Th><Th>Transactions</Th></tr></Thead>
            <Tbody>
              {[...monthly].reverse().map((m: any) => (
                <Tr key={m.month}>
                  <Td className="text-slate-700 font-medium">{monthLabel(m.month)}</Td>
                  <Td className="font-semibold text-slate-900">{formatInrFull(m.revenue)}</Td>
                  <Td className="text-slate-500">{m.count}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
