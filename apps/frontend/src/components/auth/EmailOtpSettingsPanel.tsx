'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldOff, Lock } from 'lucide-react';
import { useEmailOtpStatus, useEnableEmailOtp, useDisableEmailOtp } from '@/hooks/use-mfa';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { extractErrorMessage } from '@/lib/error-message';

export function EmailOtpSettingsPanel() {
  const { data: status, isLoading, refetch } = useEmailOtpStatus();
  const enableMutation = useEnableEmailOtp();
  const disableMutation = useDisableEmailOtp();

  const [showDisableForm, setShowDisableForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleEnable() {
    setError(null);
    try {
      await enableMutation.mutateAsync();
      refetch();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleDisable() {
    if (!currentPassword) return;
    setError(null);
    try {
      await disableMutation.mutateAsync(currentPassword);
      setShowDisableForm(false);
      setCurrentPassword('');
      refetch();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-app-t4">Loading…</p>;
  }

  const enabled = status?.enabled ?? false;
  const required = status?.required ?? false;

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex items-start justify-between rounded-lg border border-app-border bg-app-s1 p-5">
        <div className="flex items-start gap-3">
          {enabled || required ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-green-400 flex-shrink-0" />
          ) : (
            <ShieldOff className="mt-0.5 h-5 w-5 text-app-t3 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-app-text">Email verification code</p>
            <p className="text-xs text-app-t3 mt-0.5">
              {required
                ? 'Your role requires a 6-digit code by email at every sign-in.'
                : enabled
                  ? 'A 6-digit code is emailed to you at every sign-in.'
                  : 'Require a 6-digit code emailed to you at every sign-in, for extra protection.'}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          {required ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              <Lock className="h-3 w-3" /> Required
            </span>
          ) : enabled ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-app-s2 px-2.5 py-0.5 text-xs font-medium text-app-t2">
              Disabled
            </span>
          )}
        </div>
      </div>

      {required ? null : enabled ? (
        !showDisableForm ? (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowDisableForm(true)}
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              Disable
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
            <p className="text-sm font-medium text-red-800">Enter your password to confirm:</p>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="max-w-xs"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleDisable}
                isLoading={disableMutation.isPending}
                disabled={!currentPassword}
                className="text-red-400 border-red-500/50 hover:bg-red-100"
              >
                Confirm disable
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowDisableForm(false); setCurrentPassword(''); setError(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="flex justify-end">
          <Button onClick={handleEnable} isLoading={enableMutation.isPending}>
            Enable
          </Button>
        </div>
      )}
    </div>
  );
}
