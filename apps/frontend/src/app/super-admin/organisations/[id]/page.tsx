'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Pencil, Power, PowerOff, Trash2, HardDrive } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { TeamPanel } from '@/components/team/TeamPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { formatBytes } from '@/lib/format';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PAST_DUE: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral', PENDING_INVITE: 'neutral',
};

const PLANS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'] as const;

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
// yyyy-mm-dd for <input type="date">
function toDateInput(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const {
    getOrganisationById,
    updateOrganisation,
    setOrganisationStatus,
    archiveOrganisation,
    updateSubscription,
    getOrganisationStorageDetail,
  } = useSuperAdmin();

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editUserLimit, setEditUserLimit] = useState('');
  const [editStorageAddOnGb, setEditStorageAddOnGb] = useState('');
  const [editPlan, setEditPlan] = useState('');
  // What was actually loaded from the server -- handleSave only sends a
  // field if it genuinely differs from this, so changing just the plan
  // dropdown doesn't also resend a stale userLimit/storageAddOnGb value and
  // accidentally override the server's plan-driven auto-recomputation of
  // storageLimitGb/userLimit (see updateOrganisation's own comment on why
  // that recomputation only fires when the caller omits the field).
  const [loadedUserLimit, setLoadedUserLimit] = useState('');
  const [loadedStorageAddOnGb, setLoadedStorageAddOnGb] = useState('');
  const [loadedPlan, setLoadedPlan] = useState('');

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [subStart, setSubStart] = useState('');
  const [subEnd, setSubEnd] = useState('');
  const [subSaving, setSubSaving] = useState(false);
  const [subMsg, setSubMsg] = useState('');
  const [subError, setSubError] = useState('');

  const [storageDetail, setStorageDetail] = useState<any>(null);

  useEffect(() => {
    getOrganisationById(params.id as string).then((res) => {
      if (res.success) {
        const d = res.data as any;
        setOrg(d);
        setEditUserLimit(String(d.userLimit));
        setEditStorageAddOnGb(String(d.storageAddOnGb ?? 0));
        setEditPlan(d.planSlug ?? '');
        setLoadedUserLimit(String(d.userLimit));
        setLoadedStorageAddOnGb(String(d.storageAddOnGb ?? 0));
        setLoadedPlan(d.planSlug ?? '');
        setEditName(d.name);
        setSubStart(toDateInput(d.subscription?.currentPeriodStart));
        setSubEnd(toDateInput(d.subscription?.currentPeriodEnd));
      }
      setLoading(false);
    });
    getOrganisationStorageDetail(params.id as string).then((res) => {
      if (res.success) setStorageDetail(res.data);
    });
  }, [params.id, getOrganisationById, getOrganisationStorageDetail]);

  function mergeOrg(updated: any) {
    setOrg((prev: any) => ({
      ...prev,
      ...updated,
      invoices: updated.invoices ?? prev.invoices,
      payments: updated.payments ?? prev.payments,
      subscription: updated.subscription ?? prev.subscription,
    }));
  }

  async function handleSave() {
    setSaving(true); setSaveMsg(''); setSaveError('');
    const res = await updateOrganisation(params.id as string, {
      // Only sent when actually changed from what was loaded -- otherwise a
      // plan change would also resend the old userLimit/storageAddOnGb and
      // suppress the server's plan-driven auto-recomputation.
      ...(editUserLimit !== loadedUserLimit && { userLimit: parseInt(editUserLimit) || undefined }),
      ...(editStorageAddOnGb !== loadedStorageAddOnGb && { storageAddOnGb: parseInt(editStorageAddOnGb) || 0 }),
      ...(editPlan !== loadedPlan && { planSlug: editPlan || undefined }),
    });
    setSaving(false);
    if (res.success) {
      setSaveMsg('Changes saved successfully.');
      const saved = res.data as any;
      mergeOrg(saved);
      setEditUserLimit(String(saved.userLimit));
      setEditStorageAddOnGb(String(saved.storageAddOnGb ?? 0));
      setEditPlan(saved.planSlug ?? '');
      setLoadedUserLimit(String(saved.userLimit));
      setLoadedStorageAddOnGb(String(saved.storageAddOnGb ?? 0));
      setLoadedPlan(saved.planSlug ?? '');
    } else {
      setSaveError(res.message || 'Could not save changes. Please try again.');
    }
  }

  async function handleRename() {
    if (!editName.trim() || editName.trim() === org.name) { setIsEditingName(false); return; }
    setRenaming(true); setSaveError('');
    const res = await updateOrganisation(params.id as string, { name: editName.trim() });
    setRenaming(false);
    if (res.success) {
      mergeOrg(res.data);
      setIsEditingName(false);
    } else {
      setSaveError(res.message || 'Could not rename this organisation.');
    }
  }

  async function handleToggleStatus() {
    const next = org.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const message =
      next === 'SUSPENDED'
        ? `Deactivate "${org.name}"?\n\nThis will prevent all users belonging to this organisation from accessing the VDR. No data will be deleted.`
        : `Activate "${org.name}"?\n\nThis will restore VDR access for all users belonging to this organisation.`;
    if (!window.confirm(message)) return;

    setStatusBusy(true); setStatusError('');
    const res = await setOrganisationStatus(params.id as string, next);
    setStatusBusy(false);
    if (res.success) {
      setOrg((prev: any) => ({ ...prev, status: next }));
    } else {
      setStatusError(res.message || 'Could not change this organisation\'s status.');
    }
  }

  async function handleDelete() {
    setDeleting(true); setDeleteError('');
    const res = await archiveOrganisation(params.id as string, confirmDeleteName);
    setDeleting(false);
    if (res.success) {
      router.push('/super-admin/organisations');
    } else {
      setDeleteError(res.message || 'Could not delete this organisation.');
    }
  }

  async function handleSaveSubscription() {
    setSubSaving(true); setSubMsg(''); setSubError('');
    const res = await updateSubscription(params.id as string, {
      currentPeriodStart: subStart || undefined,
      currentPeriodEnd: subEnd || undefined,
    });
    setSubSaving(false);
    if (res.success) {
      setSubMsg('Subscription dates saved.');
      setOrg((prev: any) => ({ ...prev, subscription: res.data }));
    } else {
      setSubError(res.message || 'Could not save subscription dates.');
    }
  }

  if (loading) return <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />;
  if (!org) return <p className="text-sm text-rose-600">Organisation not found.</p>;

  const hasActiveSubscription = org.subscription?.status === 'ACTIVE' && new Date(org.subscription.currentPeriodEnd) > new Date();
  // org.subscription.status is the raw stored value -- nothing flips it to
  // EXPIRED when currentPeriodEnd passes (no scheduled job does that), so a
  // subscription whose period already ended still reads 'ACTIVE' here. The
  // Status badge below must show the same effective state hasActiveSubscription
  // already derives, or it contradicts the org list page's own status pill
  // (which already gets this right) and the backend's isSubscriptionLapsed().
  const displaySubStatus =
    org.subscription?.status === 'ACTIVE' && !hasActiveSubscription ? 'EXPIRED' : org.subscription?.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-sm" autoFocus />
              <Button size="sm" onClick={handleRename} isLoading={renaming}>Save</Button>
              <Button size="sm" variant="secondary" onClick={() => { setIsEditingName(false); setEditName(org.name); }}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => setIsEditingName(true)} className="group flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
              <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
            </button>
          )}
          <p className="text-sm text-slate-400">{org.slug}</p>
        </div>
        {org.planSlug && <Badge tone="brand">{org.planSlug}</Badge>}
        <Badge tone={org.status === 'SUSPENDED' ? 'danger' : 'success'}>{org.status}</Badge>
      </div>

      {saveError && <Alert tone="danger">{saveError}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Subscription info + date management */}
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {org.subscription ? (
              <>
                <Row label="Status"><Badge tone={STATUS_TONE[displaySubStatus] ?? 'neutral'}>{displaySubStatus}</Badge></Row>
                <Row label="Plan">{org.subscription.planSlug}</Row>
                <Row label="Cycle">{org.subscription.billingCycle}</Row>
                <Row label="Storage">{org.subscription.storageGb} GB</Row>
              </>
            ) : (
              <p className="text-slate-400">No subscription on record yet — set both dates below to create one.</p>
            )}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              {subMsg && <Alert tone="success">{subMsg}</Alert>}
              {subError && <Alert tone="danger">{subError}</Alert>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
                <input type="date" value={subStart} onChange={(e) => setSubStart(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
                <input type="date" value={subEnd} onChange={(e) => setSubEnd(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <Button size="sm" onClick={handleSaveSubscription} isLoading={subSaving} className="w-full">
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Subscription Dates
              </Button>
              <p className="text-xs text-slate-400">
                Extend, early-expire, or reactivate by picking an end date and saving — no data is affected by a date change.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Admin controls */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Admin Controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {saveMsg && <Alert tone="success">{saveMsg}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— No plan (legacy) —</option>
                  {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400">Changing the plan updates the base user/storage entitlement below, unless you also edit them in this same save.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">User Limit</label>
                <Input type="number" min={1} value={editUserLimit} onChange={(e) => setEditUserLimit(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Storage Add-on (GB)</label>
                <Input type="number" min={0} value={editStorageAddOnGb} onChange={(e) => setEditStorageAddOnGb(e.target.value)} />
                <p className="mt-1 text-xs text-slate-400">On top of the plan&apos;s base storage. Preserved automatically if the plan later changes.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Effective Storage Limit</label>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {org.planBaseStorageGb != null ? (
                    <>{org.planBaseStorageGb} GB ({org.planSlug} base) + {org.storageAddOnGb ?? 0} GB add-on = <strong>{org.storageLimitGb} GB</strong></>
                  ) : (
                    <>{org.storageLimitGb} GB (server-computed)</>
                  )}
                </p>
              </div>
            </div>
            <Button onClick={handleSave} isLoading={saving} size="sm">
              <Save className="h-4 w-4 mr-1.5" /> Save Changes
            </Button>

            {/* Storage breakdown */}
            <div className="border-t border-slate-100 pt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                <HardDrive className="h-3.5 w-3.5" /> Storage Breakdown
              </p>
              {storageDetail ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                  <div><p className="text-slate-400 text-xs">Live ({storageDetail.breakdown.live.fileCount} files)</p><p className="font-medium">{formatBytes(storageDetail.breakdown.live.bytes)}</p></div>
                  <div><p className="text-slate-400 text-xs">Trash ({storageDetail.breakdown.trash.fileCount} files)</p><p className="font-medium">{formatBytes(storageDetail.breakdown.trash.bytes)}</p></div>
                  <div><p className="text-slate-400 text-xs">Prior versions</p><p className="font-medium">{formatBytes(storageDetail.breakdown.priorVersions.bytes)}</p></div>
                  <div><p className="text-slate-400 text-xs">Folders / Data rooms</p><p className="font-medium">{storageDetail.counts.folders} / {storageDetail.counts.dataRooms}</p></div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Loading…</p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Trash and prior file versions are real disk usage but do not count against the storage limit above.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription seat count -- currently active, accepted members only.
          TeamPanel below deliberately lists everyone (including pending
          invitations and suspended members), since managing those is the
          point of that view; this line is specifically the number that
          counts toward the plan's user limit. */}
      <div className="flex items-center gap-3 text-sm">
        <span className={org.activeUserCount > org.userLimit ? 'font-semibold text-amber-600' : 'font-semibold text-slate-800'}>
          {org.activeUserCount} / {org.userLimit} Users
        </span>
        {org.pendingInvitationCount > 0 && (
          <span className="text-slate-400">{org.pendingInvitationCount} pending invitation{org.pendingInvitationCount === 1 ? '' : 's'} (not counted)</span>
        )}
      </div>

      {/* Team -- membership-scoped (post multi-org), with suspend/reinstate */}
      <TeamPanel organisationId={params.id as string} />

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

      {/* Danger zone -- deliberately visually distinct and separated from
          every other control on this page. */}
      <Card className="border-rose-200">
        <CardHeader><CardTitle className="text-rose-700">Danger Zone</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {statusError && <Alert tone="danger">{statusError}</Alert>}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">{org.status === 'SUSPENDED' ? 'Activate this organisation' : 'Deactivate this organisation'}</p>
              <p className="text-xs text-slate-500">
                {org.status === 'SUSPENDED'
                  ? 'Restores VDR access for every user in this organisation. No data was ever touched.'
                  : 'Immediately blocks every user in this organisation from the VDR. No data is deleted — fully reversible.'}
              </p>
            </div>
            <Button variant={org.status === 'SUSPENDED' ? 'primary' : 'secondary'} size="sm" onClick={handleToggleStatus} isLoading={statusBusy}>
              {org.status === 'SUSPENDED' ? <Power className="h-4 w-4 mr-1.5" /> : <PowerOff className="h-4 w-4 mr-1.5" />}
              {org.status === 'SUSPENDED' ? 'Activate' : 'Deactivate'}
            </Button>
          </div>

          <div className="border-t border-rose-100 pt-5">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Delete this organisation</p>
                  <p className="text-xs text-slate-500">
                    Archives the organisation (soft-delete) — users, files, folders, audit logs, and subscription
                    history are all retained and recoverable. Nothing is permanently erased.
                    {hasActiveSubscription && (
                      <span className="block mt-1 font-medium text-amber-600">
                        This organisation has an active subscription — deleting it will block every user immediately.
                      </span>
                    )}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
                {deleteError && <Alert tone="danger">{deleteError}</Alert>}
                <p className="text-sm text-rose-900">
                  This will archive <b>{org.name}</b> and immediately block every one of its users from the VDR.
                  No data is deleted and this can be reversed, but only by direct database access — there is no
                  self-service &ldquo;reactivate an archived organisation&rdquo; button yet.
                  {hasActiveSubscription && ' This organisation currently has an active subscription.'}
                </p>
                <div>
                  <label className="block text-xs font-medium text-rose-800 mb-1">
                    Type <span className="font-mono">{org.name}</span> to confirm
                  </label>
                  <Input value={confirmDeleteName} onChange={(e) => setConfirmDeleteName(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={confirmDeleteName !== org.name}
                    isLoading={deleting}
                    onClick={handleDelete}
                  >
                    Confirm Delete
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setShowDeleteConfirm(false); setConfirmDeleteName(''); setDeleteError(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
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
