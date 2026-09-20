'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ExternalLink, Plus, X } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PAST_DUE: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral',
};

const PLANS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'] as const;

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_PROVISION_FORM = {
  fullName: '', companyName: '', email: '', mobileNumber: '',
  gstNumber: '', companyAddress: '', selectedPlan: 'STARTER' as string,
  selectedStorageGb: '5', billingCycle: 'MONTHLY' as string,
  poNumber: '', notes: '',
};

function AdminProvisionForm({ onDone }: { onDone: () => void }) {
  const { adminProvisionOrg } = useSuperAdmin();
  const [form, setForm] = useState(EMPTY_PROVISION_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof typeof EMPTY_PROVISION_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await adminProvisionOrg({
      fullName: form.fullName,
      companyName: form.companyName,
      email: form.email,
      mobileNumber: form.mobileNumber,
      gstNumber: form.gstNumber || undefined,
      companyAddress: form.companyAddress || undefined,
      selectedPlan: form.selectedPlan,
      selectedStorageGb: parseInt(form.selectedStorageGb, 10) || 1,
      billingCycle: form.billingCycle,
      poNumber: form.poNumber || undefined,
      notes: form.notes || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      onDone();
    } else {
      setError(res.message || 'Could not provision this organisation. Please try again.');
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>New Organisation — Invoice / PO Billing</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          Provisions and activates the organisation immediately — no payment gateway involved. Use this for
          enterprise deals that pay by invoice rather than card. The new Org Admin gets a password-setup email
          right away.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Org Admin full name</label>
              <Input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Org Admin email</label>
              <Input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company name</label>
              <Input required value={form.companyName} onChange={(e) => update('companyName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mobile number</label>
              <Input required value={form.mobileNumber} onChange={(e) => update('mobileNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">GST number (optional)</label>
              <Input value={form.gstNumber} onChange={(e) => update('gstNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company address (optional)</label>
              <Input value={form.companyAddress} onChange={(e) => update('companyAddress', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
              <select
                value={form.selectedPlan}
                onChange={(e) => update('selectedPlan', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Storage (GB, max 200)</label>
              <Input
                required type="number" min={1} max={200}
                value={form.selectedStorageGb}
                onChange={(e) => update('selectedStorageGb', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Billing cycle</label>
              <select
                value={form.billingCycle}
                onChange={(e) => update('billingCycle', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">PO / invoice reference (optional)</label>
              <Input value={form.poNumber} onChange={(e) => update('poNumber', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Internal notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" isLoading={submitting} size="sm">
            Provision Organisation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function OrganisationsPage() {
  const { getOrganisations } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [showProvisionForm, setShowProvisionForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getOrganisations(page, 20, search || undefined);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getOrganisations, page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organisations</h1>
          <p className="mt-0.5 text-sm text-slate-500">All customer organisations on the platform.</p>
        </div>
        <div className="flex items-center gap-3">
          {data && <span className="text-sm text-slate-500">{data.total} total</span>}
          <Button size="sm" variant={showProvisionForm ? 'secondary' : 'primary'} onClick={() => setShowProvisionForm((v) => !v)}>
            {showProvisionForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> New Organisation (Invoice)</>}
          </Button>
        </div>
      </div>

      {showProvisionForm && (
        <AdminProvisionForm
          onDone={() => {
            setShowProvisionForm(false);
            load();
          }}
        />
      )}

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <Input
          placeholder="Search by name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="sm">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Organisation</Th>
              <Th>Plan</Th>
              <Th>Users</Th>
              <Th>Storage</Th>
              <Th>Sub Status</Th>
              <Th>Created</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr><Td colSpan={7} className="text-center text-slate-400 py-8">Loading…</Td></Tr>
            )}
            {!loading && data?.items?.length === 0 && (
              <Tr><Td colSpan={7} className="text-center text-slate-400 py-8">No organisations found.</Td></Tr>
            )}
            {!loading && data?.items?.map((org: any) => (
              <Tr key={org.id}>
                <Td>
                  <p className="font-medium text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-400">{org.slug}</p>
                </Td>
                <Td>{org.planSlug ? <Badge tone="brand">{org.planSlug}</Badge> : <span className="text-slate-400">—</span>}</Td>
                <Td>{org._count?.users ?? 0} / {org.userLimit}</Td>
                <Td>{org.subscription?.storageGb ?? org.storageLimitGb} GB</Td>
                <Td>
                  {org.subscription ? (
                    <Badge tone={STATUS_TONE[org.subscription.status] ?? 'neutral'}>
                      {org.subscription.status}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-xs">No subscription</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{formatDate(org.createdAt)}</Td>
                <Td>
                  <Link href={`/super-admin/organisations/${org.id}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700">
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
