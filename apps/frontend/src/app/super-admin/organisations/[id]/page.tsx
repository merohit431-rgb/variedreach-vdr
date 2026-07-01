'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

const ROLE_TONE: Record<string, 'brand' | 'neutral' | 'warning'> = {
  ORG_ADMIN: 'brand', RP_LIQUIDATOR: 'warning',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PAST_DUE: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral', PENDING_INVITE: 'neutral',
};

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getOrganisationById, updateOrganisation } = useSuperAdmin();

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editUserLimit, setEditUserLimit] = useState('');
  const [editStorageGb, setEditStorageGb] = useState('');
  const [editPlan, setEditPlan] = useState('');

  useEffect(() => {
    getOrganisationById(params.id as string).then((res) => {
      if (res.success) {
        const d = res.data as any;
        setOrg(d);
        setEditUserLimit(String(d.userLimit));
        setEditStorageGb(String(d.storageLimitGb));
        setEditPlan(d.planSlug ?? '');
      }
      setLoading(false);
    });
  }, [params.id, getOrganisationById]);

  async function handleSave() {
    setSaving(true); setSaveMsg(''); setSaveError('');
    const res = await updateOrganisation(params.id as string, {
      userLimit: parseInt(editUserLimit) || undefined,
      storageLimitGb: parseInt(editStorageGb) || undefined,
      planSlug: editPlan || undefined,
    });
    setSaving(false);
    if (res.success) { setSaveMsg('Saved successfully.'); setOrg(res.data); }
    else setSaveError(res.message);
  }

  if (loading) return <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />;
  if (!org) return <p className="text-sm text-rose-600">Organisation not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
          <p className="text-sm text-slate-400">{org.slug}</p>
        </div>
        {org.planSlug && <Badge tone="brand">{org.planSlug}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Subscription info */}
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {org.subscription ? (
              <>
                <Row label="Status"><Badge tone={STATUS_TONE[org.subscription.status] ?? 'neutral'}>{org.subscription.status}</Badge></Row>
                <Row label="Plan">{org.subscription.planSlug}</Row>
                <Row label="Cycle">{org.subscription.billingCycle}</Row>
                <Row label="Storage">{org.subscription.storageGb} GB</Row>
                <Row label="Period end">{formatDate(org.subscription.currentPeriodEnd)}</Row>
              </>
            ) : (
              <p className="text-slate-400">No subscription</p>
            )}
          </CardContent>
        </Card>

        {/* Admin controls */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Admin Controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {saveMsg && <Alert tone="success">{saveMsg}</Alert>}
            {saveError && <Alert tone="danger">{saveError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">User Limit</label>
                <Input type="number" min={1} value={editUserLimit} onChange={(e) => setEditUserLimit(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Storage Limit (GB)</label>
                <Input type="number" min={1} value={editStorageGb} onChange={(e) => setEditStorageGb(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plan Slug</label>
                <Input value={editPlan} onChange={(e) => setEditPlan(e.target.value)} placeholder="STARTER" />
              </div>
            </div>
            <Button onClick={handleSave} isLoading={saving} size="sm">
              <Save className="h-4 w-4 mr-1.5" /> Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Users */}
      <Card>
        <CardHeader><CardTitle>Users ({org.users.length})</CardTitle></CardHeader>
        <TableContainer className="border-0 shadow-none rounded-none">
          <Table>
            <Thead><tr>
              <Th>Name / Email</Th><Th>Role</Th><Th>Status</Th><Th>Last login</Th><Th>Joined</Th>
            </tr></Thead>
            <Tbody>
              {org.users.map((u: any) => (
                <Tr key={u.id}>
                  <Td>
                    <p className="font-medium text-slate-800">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </Td>
                  <Td><Badge tone={ROLE_TONE[u.role] ?? 'neutral'}>{u.role}</Badge></Td>
                  <Td><Badge tone={STATUS_TONE[u.status] ?? 'neutral'}>{u.status}</Badge></Td>
                  <Td className="text-slate-500 whitespace-nowrap">{formatDate(u.lastLoginAt)}</Td>
                  <Td className="text-slate-500 whitespace-nowrap">{formatDate(u.createdAt)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <TableContainer className="border-0 shadow-none rounded-none">
            <Table>
              <Thead><tr><Th>Invoice #</Th><Th>Amount</Th><Th>Status</Th><Th>Issued</Th></tr></Thead>
              <Tbody>
                {org.invoices.length === 0 && <Tr><Td colSpan={4} className="text-center text-slate-400">None yet.</Td></Tr>}
                {org.invoices.map((inv: any) => (
                  <Tr key={inv.id}>
                    <Td className="font-mono text-xs">{inv.invoiceNumber}</Td>
                    <Td>{formatInr(inv.totalAmountPaisa)}</Td>
                    <Td><Badge tone={inv.status === 'PAID' ? 'success' : 'neutral'}>{inv.status}</Badge></Td>
                    <Td className="text-slate-500 whitespace-nowrap">{formatDate(inv.issuedAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
          <TableContainer className="border-0 shadow-none rounded-none">
            <Table>
              <Thead><tr><Th>Amount</Th><Th>Status</Th><Th>Gateway ID</Th><Th>Date</Th></tr></Thead>
              <Tbody>
                {org.payments.length === 0 && <Tr><Td colSpan={4} className="text-center text-slate-400">None yet.</Td></Tr>}
                {org.payments.map((p: any) => (
                  <Tr key={p.id}>
                    <Td className="font-medium">{formatInr(p.amountPaisa)}</Td>
                    <Td><Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge></Td>
                    <Td className="text-xs font-mono text-slate-500 max-w-[120px] truncate">{p.gatewayPaymentId ?? '—'}</Td>
                    <Td className="text-slate-500 whitespace-nowrap">{formatDate(p.paidAt ?? p.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{children}</span>
    </div>
  );
}
