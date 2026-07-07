'use client';

import { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useTrustedDevices, useRevokeTrustedDevice } from '@/hooks/use-trusted-devices';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function TrustedDevicesPanel() {
  const { data: devices, isLoading } = useTrustedDevices();
  const revokeDevice = useRevokeTrustedDevice();
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(deviceId: string) {
    setError(null);
    try {
      await revokeDevice.mutateAsync(deviceId);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-app-t4">Loading…</p>;
  }

  if ((devices ?? []).length === 0) {
    return (
      <p className="text-sm text-app-t4">
        No remembered devices. When you verify a code and choose &quot;remember this device,&quot; it will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {(devices ?? []).map((device) => (
        <div
          key={device.id}
          className="flex items-center justify-between rounded-lg border border-app-border bg-app-s1 p-4"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-t3" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-app-text">{device.label}</p>
              <p className="mt-0.5 text-xs text-app-t4">
                {device.ipAddress ?? 'Unknown IP'} · Last used{' '}
                {device.lastUsedAt ? relativeTime(device.lastUsedAt) : 'never'} · Remembered until{' '}
                {new Date(device.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRevoke(device.id)}
            isLoading={revokeDevice.isPending}
            className="flex-shrink-0 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Revoke
          </Button>
        </div>
      ))}
    </div>
  );
}
