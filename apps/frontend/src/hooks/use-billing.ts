'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { fetchFileBlob } from '@/hooks/use-files';
import { extractErrorMessage } from '@/lib/error-message';

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  amountPaisa: number;
  gstAmountPaisa: number;
  totalAmountPaisa: number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  subscription?: { planSlug: string; billingCycle: string } | null;
}

// Amounts are stored in true paise — divide by 100 for rupees.
export function formatInvoiceInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function triggerPdfDownload(path: string, filename: string) {
  const blob = await fetchFileBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useBilling() {
  const listInvoices = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: InvoiceRecord[] }>('/billing/invoices');
      return { success: true as const, data: res.data.data };
    } catch (error) {
      return { success: false as const, message: extractErrorMessage(error) };
    }
  }, []);

  // Org-admin: own-org invoice PDF.
  const downloadInvoice = useCallback(async (id: string, invoiceNumber: string) => {
    await triggerPdfDownload(`/billing/invoices/${id}/pdf`, `${invoiceNumber}.pdf`);
  }, []);

  // Super-admin: any invoice PDF.
  const downloadInvoiceAsAdmin = useCallback(async (id: string, invoiceNumber: string) => {
    await triggerPdfDownload(`/super-admin/invoices/${id}/pdf`, `${invoiceNumber}.pdf`);
  }, []);

  return { listInvoices, downloadInvoice, downloadInvoiceAsAdmin };
}
