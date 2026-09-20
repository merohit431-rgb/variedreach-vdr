'use client';

import { useState, useEffect } from 'react';
import { Globe, FileText, Stamp } from 'lucide-react';
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
  watermarkTemplate?: string;
  watermarkOpacity?: number;
  watermarkPosition?: string;
}

const WATERMARK_TOKENS = ['{{name}}', '{{email}}', '{{date}}', '{{time}}', '{{ip}}'];

export function SecuritySettingsPanel({ dataRoomId }: { dataRoomId: string }) {
  const { data: dataRoom } = useDataRoom(dataRoomId);
  const room = dataRoom as unknown as ExtendedDataRoom | undefined;
  const updateSecurity = useUpdateSecuritySettings(dataRoomId);

  const [ipEnabled, setIpEnabled] = useState(false);
  const [ipsText, setIpsText] = useState('');
  const [ndaEnabled, setNdaEnabled] = useState(false);
  const [ndaText, setNdaText] = useState('');
  const [watermarkTemplate, setWatermarkTemplate] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);
  const [watermarkPosition, setWatermarkPosition] = useState<'diagonal' | 'tiled'>('diagonal');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (room) {
      setIpEnabled(room.ipAllowlistEnabled ?? false);
      setIpsText((room.allowedIps ?? []).join('\n'));
      setNdaEnabled(room.ndaEnabled ?? false);
      setNdaText(room.ndaText ?? '');
      setWatermarkTemplate(room.watermarkTemplate ?? '{{name}} | {{email}} | {{date}} | {{ip}} | CONFIDENTIAL');
      setWatermarkOpacity(room.watermarkOpacity ?? 0.25);
      setWatermarkPosition(room.watermarkPosition === 'tiled' ? 'tiled' : 'diagonal');
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
        watermarkTemplate,
        watermarkOpacity,
        watermarkPosition,
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
      <div className="rounded-lg border border-app-border bg-app-s1 p-5">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 text-app-t3 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-app-text">IP Allowlisting</h3>
                <p className="mt-0.5 text-xs text-app-t3">
                  Restrict access to this data room to specific IP addresses or CIDR ranges.
                  Org admins are never blocked.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-xs text-app-t3">{ipEnabled ? 'Enabled' : 'Disabled'}</span>
                <div
                  onClick={() => setIpEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ipEnabled ? 'bg-app-primary' : 'bg-app-s3'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-app-s1 shadow transition-transform ${ipEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {ipEnabled && (
              <div className="mt-3">
                <label className="text-xs font-medium text-app-t2">
                  Allowed IPs / CIDR ranges (one per line)
                </label>
                <textarea
                  value={ipsText}
                  onChange={(e) => setIpsText(e.target.value)}
                  rows={5}
                  placeholder={'192.168.1.0/24\n10.0.0.1\n2001:db8::/32'}
                  className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <p className="mt-1 text-xs text-app-t3">
                  Leave empty to allow all IPs (disables restriction even when enabled).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NDA Gate */}
      <div className="rounded-lg border border-app-border bg-app-s1 p-5">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-app-t3 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-app-text">NDA Gate</h3>
                <p className="mt-0.5 text-xs text-app-t3">
                  Require members to accept a non-disclosure agreement before viewing content.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-xs text-app-t3">{ndaEnabled ? 'Enabled' : 'Disabled'}</span>
                <div
                  onClick={() => setNdaEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ndaEnabled ? 'bg-app-primary' : 'bg-app-s3'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-app-s1 shadow transition-transform ${ndaEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {ndaEnabled && (
              <div className="mt-3">
                <label className="text-xs font-medium text-app-t2">
                  NDA text (optional — leave blank for default)
                </label>
                <textarea
                  value={ndaText}
                  onChange={(e) => setNdaText(e.target.value)}
                  rows={6}
                  placeholder="By accepting, you agree to keep all information confidential…"
                  className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Watermarking */}
      <div className="rounded-lg border border-app-border bg-app-s1 p-5">
        <div className="flex items-start gap-3">
          <Stamp className="mt-0.5 h-5 w-5 text-app-t3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-app-text">Watermarking</h3>
            <p className="mt-0.5 text-xs text-app-t3">
              Every preview and download is stamped with the viewer&apos;s identity. Customize how
              it reads and how visible it is — it can&apos;t be turned off.
            </p>

            <div className="mt-3">
              <label className="text-xs font-medium text-app-t2">Text template</label>
              <input
                type="text"
                value={watermarkTemplate}
                onChange={(e) => setWatermarkTemplate(e.target.value)}
                placeholder="{{name}} | {{email}} | {{date}} | {{ip}} | CONFIDENTIAL"
                className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <p className="mt-1 text-xs text-app-t3">
                Tokens: {WATERMARK_TOKENS.map((t) => (
                  <code key={t} className="mx-0.5 rounded bg-app-s2 px-1 py-0.5 font-mono">{t}</code>
                ))}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-app-t2">
                  Visibility — {Math.round(watermarkOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                  className="mt-2 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-app-t2">Pattern</label>
                <select
                  value={watermarkPosition}
                  onChange={(e) => setWatermarkPosition(e.target.value === 'tiled' ? 'tiled' : 'diagonal')}
                  className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="diagonal">Diagonal</option>
                  <option value="tiled">Straight</option>
                </select>
              </div>
            </div>
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
