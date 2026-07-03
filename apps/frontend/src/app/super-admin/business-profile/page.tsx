'use client';

import { useEffect, useState } from 'react';
import { Save, Store } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

interface ProfileForm {
  businessName: string;
  tagline: string;
  legalName: string;
  pan: string;
  gstNumber: string;
  address: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
}

const EMPTY: ProfileForm = {
  businessName: '', tagline: '', legalName: '', pan: '', gstNumber: '',
  address: '', supportEmail: '', supportPhone: '', website: '',
};

const FIELDS: { key: keyof ProfileForm; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'businessName', label: 'Business name' },
  { key: 'tagline', label: 'Tagline', hint: 'Shown under the logo everywhere' },
  { key: 'legalName', label: 'Legal name', hint: 'Seller name on invoices' },
  { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F' },
  { key: 'gstNumber', label: 'GST number', hint: 'Leave blank until GST registration is obtained — set it here and invoices switch on GST automatically' },
  { key: 'supportEmail', label: 'Support email' },
  { key: 'supportPhone', label: 'Support phone' },
  { key: 'website', label: 'Website' },
];

export default function BusinessProfilePage() {
  const { getBusinessProfile, updateBusinessProfile } = useSuperAdmin();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getBusinessProfile().then((res) => {
      if (res.success) {
        const d = res.data as Record<string, string | null>;
        setForm({
          businessName: d.businessName ?? '', tagline: d.tagline ?? '',
          legalName: d.legalName ?? '', pan: d.pan ?? '', gstNumber: d.gstNumber ?? '',
          address: d.address ?? '', supportEmail: d.supportEmail ?? '',
          supportPhone: d.supportPhone ?? '', website: d.website ?? '',
        });
      } else {
        setError(res.message);
      }
      setLoading(false);
    });
  }, [getBusinessProfile]);

  function set(key: keyof ProfileForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true); setMsg(''); setError('');
    const res = await updateBusinessProfile(form as unknown as Record<string, string>);
    setSaving(false);
    if (res.success) setMsg('Business profile saved. It now applies across the app, emails, and invoices.');
    else setError(res.message || 'Could not save. Please try again.');
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
          <Store className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Business Profile</h1>
          <p className="text-sm text-slate-500">
            The single source of truth for seller identity — used across the app, emails, and every invoice.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Seller &amp; support details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {msg && <Alert tone="success">{msg}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}

          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className={f.key === 'gstNumber' ? 'sm:col-span-2' : undefined}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{f.label}</label>
                    <Input
                      value={form[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                    {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Registered address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleSave} isLoading={saving} size="sm">
                  <Save className="mr-1.5 h-4 w-4" /> Save changes
                </Button>
                {!form.gstNumber && (
                  <span className="text-xs text-slate-400">
                    Not registered under GST — invoices show no GST.
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
