'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Copy, Pencil, Trash2, Download, Power, Ticket, Search } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { fetchFileBlob } from '@/hooks/use-files';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

const PLANS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'];

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrderPaisa: number | null;
  maxDiscountPaisa: number | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  applicablePlans: string[];
  status: 'ACTIVE' | 'DISABLED';
  description: string | null;
  internalNotes: string | null;
  redemptionCount?: number;
}

const EMPTY_FORM = {
  code: '', type: 'PERCENT' as 'PERCENT' | 'FIXED', value: '', minOrder: '', maxDiscount: '',
  validFrom: '', validUntil: '', maxRedemptions: '', perCustomerLimit: '',
  applicablePlans: [] as string[], status: 'ACTIVE' as 'ACTIVE' | 'DISABLED', description: '', internalNotes: '',
};
type FormState = typeof EMPTY_FORM;

function discountLabel(c: Coupon) {
  return c.type === 'PERCENT' ? `${c.value}% off` : `₹${(c.value / 100).toLocaleString('en-IN')} off`;
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function CouponsPage() {
  const { getCoupons, createCoupon, updateCoupon, deleteCoupon, duplicateCoupon } = useSuperAdmin();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (q?: string) => {
    const res = await getCoupons(q);
    if (res.success) setCoupons(res.data as Coupon[]);
    else setError(res.message);
  }, [getCoupons]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }
  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code, type: c.type,
      value: c.type === 'FIXED' ? String(c.value / 100) : String(c.value),
      minOrder: c.minOrderPaisa ? String(c.minOrderPaisa / 100) : '',
      maxDiscount: c.maxDiscountPaisa ? String(c.maxDiscountPaisa / 100) : '',
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : '',
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : '',
      maxRedemptions: c.maxRedemptions ? String(c.maxRedemptions) : '',
      perCustomerLimit: c.perCustomerLimit ? String(c.perCustomerLimit) : '',
      applicablePlans: c.applicablePlans, status: c.status,
      description: c.description ?? '', internalNotes: c.internalNotes ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }

  function buildPayload() {
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const paise = (s: string) => (s.trim() === '' ? undefined : Math.round(Number(s) * 100));
    return {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.type === 'FIXED' ? Math.round(Number(form.value) * 100) : Number(form.value),
      minOrderPaisa: paise(form.minOrder),
      maxDiscountPaisa: form.type === 'PERCENT' ? paise(form.maxDiscount) : undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
      maxRedemptions: num(form.maxRedemptions),
      perCustomerLimit: num(form.perCustomerLimit),
      applicablePlans: form.applicablePlans,
      status: form.status,
      description: form.description || undefined,
      internalNotes: form.internalNotes || undefined,
    };
  }

  async function handleSave() {
    if (!form.code.trim() || !form.value) { setFormError('Code and value are required.'); return; }
    setSaving(true); setFormError('');
    const payload = buildPayload();
    const res = editing ? await updateCoupon(editing.id, payload) : await createCoupon(payload);
    setSaving(false);
    if (!res.success) { setFormError(res.message); return; }
    setModalOpen(false);
    load(search);
  }

  async function toggleStatus(c: Coupon) {
    await updateCoupon(c.id, { status: c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
    load(search);
  }
  async function handleDuplicate(c: Coupon) { await duplicateCoupon(c.id); load(search); }
  async function handleDelete(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return;
    await deleteCoupon(c.id);
    load(search);
  }
  async function handleExport(c: Coupon) {
    const blob = await fetchFileBlob(`/coupons/${c.id}/redemptions/export`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `coupon-${c.code}-usage.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function togglePlan(plan: string) {
    setForm((f) => ({
      ...f,
      applicablePlans: f.applicablePlans.includes(plan)
        ? f.applicablePlans.filter((p) => p !== plan)
        : [...f.applicablePlans, plan],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Coupons</h1>
          <p className="mt-0.5 text-sm text-slate-500">Discount codes applied at checkout.</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New coupon</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
          placeholder="Search code or description…"
          className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Code</Th><Th>Discount</Th><Th>Min order</Th><Th>Usage</Th>
              <Th>Valid until</Th><Th>Plans</Th><Th>Status</Th><Th> </Th>
            </tr>
          </Thead>
          <Tbody>
            {coupons === null && <Tr><Td colSpan={8} className="py-8 text-center text-slate-400">Loading…</Td></Tr>}
            {coupons?.length === 0 && (
              <Tr><Td colSpan={8} className="py-10 text-center">
                <Ticket className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-600">No coupons yet</p>
                <p className="text-xs text-slate-400">Create your first discount code.</p>
              </Td></Tr>
            )}
            {coupons?.map((c) => (
              <Tr key={c.id}>
                <Td className="font-mono text-xs font-semibold text-slate-800">{c.code}</Td>
                <Td className="text-slate-700">{discountLabel(c)}</Td>
                <Td className="text-slate-500">{c.minOrderPaisa ? `₹${(c.minOrderPaisa / 100).toLocaleString('en-IN')}` : '—'}</Td>
                <Td className="text-slate-600">{c.redemptionCount ?? 0}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(c.validUntil)}</Td>
                <Td className="text-xs text-slate-500">{c.applicablePlans.length ? c.applicablePlans.join(', ') : 'All'}</Td>
                <Td><Badge tone={c.status === 'ACTIVE' ? 'success' : 'neutral'}>{c.status}</Badge></Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn title="Edit" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Duplicate" onClick={() => handleDuplicate(c)}><Copy className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title={c.status === 'ACTIVE' ? 'Disable' : 'Enable'} onClick={() => toggleStatus(c)}><Power className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Export usage" onClick={() => handleExport(c)}><Download className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Delete" danger onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">{editing ? `Edit ${editing.code}` : 'New coupon'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              {formError && <Alert tone="danger">{formError}</Alert>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LAUNCH20" /></Field>
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'PERCENT' | 'FIXED' })} className={selectCls}>
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FIXED">Fixed amount (₹)</option>
                  </select>
                </Field>
                <Field label={form.type === 'PERCENT' ? 'Discount percent' : 'Discount amount (₹)'}>
                  <Input type="number" min={1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                </Field>
                {form.type === 'PERCENT' && (
                  <Field label="Max discount (₹, optional)"><Input type="number" min={0} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} /></Field>
                )}
                <Field label="Min order value (₹, optional)"><Input type="number" min={0} value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} /></Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'DISABLED' })} className={selectCls}>
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </Field>
                <Field label="Valid from (optional)"><Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></Field>
                <Field label="Valid until (optional)"><Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
                <Field label="Max total redemptions (optional)"><Input type="number" min={1} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} /></Field>
                <Field label="Per-customer limit (optional)"><Input type="number" min={1} value={form.perCustomerLimit} onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })} /></Field>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Applicable plans (none = all)</label>
                <div className="flex gap-2">
                  {PLANS.map((p) => (
                    <button key={p} type="button" onClick={() => togglePlan(p)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${form.applicablePlans.includes(p) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Description (shown internally)"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <Field label="Internal notes (never shown to customers)">
                <textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} isLoading={saving}>{editing ? 'Save changes' : 'Create coupon'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectCls = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${danger ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
      {children}
    </button>
  );
}
