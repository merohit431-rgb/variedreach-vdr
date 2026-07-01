'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success', ISSUED: 'brand' as any, DRAFT: 'neutral', VOID: 'danger',
};

export default function InvoicesPage() {
  const { getInvoices } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getInvoices(page, 25);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getInvoices, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Invoices</h1>
          <p className="mt-0.5 text-sm text-slate-500">All platform invoices across all organisations.</p>
        </div>
        {data && <span className="text-sm text-slate-500">{data.total} total</span>}
      </div>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Invoice #</Th>
              <Th>Organisation</Th>
              <Th>Base Amount</Th>
              <Th>GST (18%)</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th>Issued</Th>
              <Th>Paid</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={8} className="text-center py-8 text-slate-400">Loading…</Td></Tr>}
            {!loading && data?.items?.length === 0 && (
              <Tr><Td colSpan={8} className="text-center py-8 text-slate-400">No invoices yet.</Td></Tr>
            )}
            {!loading && data?.items?.map((inv: any) => (
              <Tr key={inv.id}>
                <Td className="font-mono text-xs font-medium text-slate-700">{inv.invoiceNumber}</Td>
                <Td className="text-slate-800">{inv.organisation?.name ?? '—'}</Td>
                <Td className="text-slate-600">{formatInr(inv.amountPaisa)}</Td>
                <Td className="text-slate-500">{formatInr(inv.gstAmountPaisa)}</Td>
                <Td className="font-semibold text-slate-900">{formatInr(inv.totalAmountPaisa)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[inv.status] ?? 'neutral'}>{inv.status}</Badge>
                </Td>
                <Td className="text-slate-500 whitespace-nowrap">{formatDate(inv.issuedAt)}</Td>
                <Td className="text-slate-500 whitespace-nowrap">{formatDate(inv.paidAt)}</Td>
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
