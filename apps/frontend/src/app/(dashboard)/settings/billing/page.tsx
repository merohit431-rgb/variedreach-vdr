'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Receipt } from 'lucide-react';
import { useBilling, formatInvoiceInr, type InvoiceRecord } from '@/hooks/use-billing';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

const STATUS: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-400',
  ISSUED: 'bg-blue-500/15 text-blue-300',
  DRAFT: 'bg-app-s2 text-app-t3',
  VOID: 'bg-red-500/15 text-red-400',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BillingPage() {
  const { listInvoices, downloadInvoice } = useBilling();
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    listInvoices().then((res) => {
      if (res.success) setInvoices(res.data);
      else setError(res.message);
    });
  }, [listInvoices]);

  async function handleDownload(inv: InvoiceRecord) {
    setDownloading(inv.id);
    try {
      await downloadInvoice(inv.id, inv.invoiceNumber);
    } catch {
      setError('Could not download the invoice. Please try again.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-app-text">Billing &amp; Invoices</h1>
        <p className="mt-0.5 text-sm text-app-t4">
          Your subscription payments and downloadable tax invoices.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
        <div className="border-b border-app-border px-5 py-3.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-app-t4">
            <Receipt className="h-3.5 w-3.5" /> Invoices
          </p>
        </div>

        {invoices === null ? (
          <div className="divide-y divide-app-border">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <FileText className="h-8 w-8 text-app-t4" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-app-t2">No invoices yet</p>
            <p className="mt-1 text-xs text-app-t4">Invoices appear here after each subscription payment.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-app-border bg-app-s2/60 text-xs">
              <tr>
                <th className="px-5 py-3 font-semibold uppercase tracking-wide text-app-t4">Invoice</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t4">Date</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t4">Amount</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wide text-app-t4">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-app-s2/50">
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-xs font-medium text-app-text">{inv.invoiceNumber}</p>
                    {inv.subscription && (
                      <p className="mt-0.5 text-[11px] text-app-t4">
                        {inv.subscription.planSlug} · {inv.subscription.billingCycle}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-app-t3">{fmtDate(inv.paidAt ?? inv.issuedAt ?? inv.createdAt)}</td>
                  <td className="px-4 py-3.5 font-semibold text-app-text">{formatInvoiceInr(inv.totalAmountPaisa)}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS[inv.status] ?? STATUS.DRAFT)}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDownload(inv)}
                      disabled={downloading === inv.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-app-t2 transition-colors hover:border-app-border2 hover:bg-app-s2 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {downloading === inv.id ? 'Preparing…' : 'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
