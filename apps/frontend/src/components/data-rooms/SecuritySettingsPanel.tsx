'use client';

import { useState, useEffect } from 'react';
import { Globe, FileText } from 'lucide-react';
import { useDataRoom, useUpdateSecuritySettings } from '@/hooks/use-data-rooms';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';

interface ExtendedDataRoom {
  id: string;
  ipAllowlistEnabled?: boolean;
  allowedIps?: string[];
  ndaEnabled?: boolean;
  ndaText?: string | null;
}

export function SecuritySettingsPanel({ dataRoomId }: { dataRoomId: string }) {
  const { data: dataRoom } = useDataRoom(dataRoomId);
  const room = dataRoom as unknown as ExtendedDataRoom | undefined;
  const updateSecurity = useUpdateSecuritySettings(dataRoomId);

  const [ipEnabled, setIpEnabled] = useState(false);
  const [ipsText, setIpsText] = useState('');
  const [ndaEnabled, setNdaEnabled] = useState(false);
  const [ndaText, setNdaText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (room) {
      setIpEnabled(room.ipAllowlistEnabled ?? false);
      setIpsText((room.allowedIps ?? []).join('\n'));
      setNdaEnabled(room.ndaEnabled ?? false);
      setNdaText(room.ndaText ?? '');
    }
  }, [room]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    const allowedIps = ipsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await updateSecurity.mutateAsync({
        ipAllowlistEnabled: ipEnabled,
        allowedIps,
        ndaEnabled,
        ndaText: ndaEnabled ? ndaText || null : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Security settings saved.</Alert>}

      {/* IP Allowlisting */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 text-slate-500 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">IP Allowlisting</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Restrict access to this data room to specific IP addresses or CIDR ranges.
                  Org admins are never blocked.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-xs text-slate-500">{ipEnabled ? 'Enabled' : 'Disabled'}</span>
                <div
                  onClick={() => setIpEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ipEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ipEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {ipEnabled && (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-700">
                  Allowed IPs / CIDR ranges (one per line)
                </label>
                <textarea
                  value={ipsText}
                  onChange={(e) => setIpsText(e.target.value)}
                  rows={5}
                  placeholder={'192.168.1.0/24\n10.0.0.1\n2001:db8::/32'}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Leave empty to allow all IPs (disables restriction even when enabled).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NDA Gate */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-slate-500 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">NDA Gate</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Require members to accept a non-disclosure agreement before viewing content.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-xs text-slate-500">{ndaEnabled ? 'Enabled' : 'Disabled'}</span>
                <div
                  onClick={() => setNdaEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ndaEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ndaEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {ndaEnabled && (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-700">
                  NDA text (optional — leave blank for default)
                </label>
                <textarea
                  value={ndaText}
                  onChange={(e) => setNdaText(e.target.value)}
                  rows={6}
                  placeholder="By accepting, you agree to keep all information confidential…"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={updateSecurity.isPending}>
          Save security settings
        </Button>
      </div>
    </div>
  );
}
