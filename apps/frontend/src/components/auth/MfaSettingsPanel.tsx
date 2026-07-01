'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { useSetupMfa, useVerifyMfaSetup, useDisableMfa, MfaSetupResult } from '@/hooks/use-mfa';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';

type Step = 'idle' | 'setup' | 'verify' | 'done';

function TotpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000"
      className="w-36 rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
    />
  );
}

interface Props {
  isMfaEnabled: boolean;
  onStatusChange: () => void;
}

export function MfaSettingsPanel({ isMfaEnabled, onStatusChange }: Props) {
  const setupMfa = useSetupMfa();
  const verifySetup = useVerifyMfaSetup();
  const disableMfa = useDisableMfa();

  const [step, setStep] = useState<Step>('idle');
  const [setupResult, setSetupResult] = useState<MfaSetupResult | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleStartSetup() {
    setError(null);
    try {
      const result = await setupMfa.mutateAsync();
      setSetupResult(result);
      setStep('setup');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleVerify() {
    if (totpCode.length !== 6) return;
    setError(null);
    try {
      await verifySetup.mutateAsync(totpCode);
      setStep('done');
      onStatusChange();
    } catch (err) {
      setError(extractErrorMessage(err));
      setTotpCode('');
    }
  }

  async function handleDisable() {
    if (disableCode.length !== 6) return;
    setError(null);
    try {
      await disableMfa.mutateAsync(disableCode);
      setShowDisable(false);
      setDisableCode('');
      onStatusChange();
    } catch (err) {
      setError(extractErrorMessage(err));
      setDisableCode('');
    }
  }

  function copySecret() {
    if (setupResult?.secret) {
      navigator.clipboard.writeText(setupResult.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900">MFA is now enabled</p>
            <p className="text-xs text-green-700 mt-0.5">
              Your account is protected with two-factor authentication.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'setup' && setupResult) {
    return (
      <div className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-sm text-slate-600">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
          then enter the 6-digit code to confirm.
        </p>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupResult.qrCodeDataUrl} alt="MFA QR code" width={180} height={180} />
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Or enter this secret manually:</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800 break-all">
                {setupResult.secret}
              </code>
              <button onClick={copySecret} className="text-slate-400 hover:text-slate-600">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Enter the code from your app:</p>
          <TotpInput value={totpCode} onChange={setTotpCode} />
          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              isLoading={verifySetup.isPending}
              disabled={totpCode.length !== 6}
            >
              Verify &amp; Enable
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setStep('idle'); setTotpCode(''); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          {isMfaEnabled ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-green-600 flex-shrink-0" />
          ) : (
            <ShieldOff className="mt-0.5 h-5 w-5 text-slate-400 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Authenticator App (TOTP)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMfaEnabled
                ? 'Two-factor authentication is active on your account.'
                : 'Add an extra layer of security to your account by requiring a time-based one-time code at login.'}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          {isMfaEnabled ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Disabled
            </span>
          )}
        </div>
      </div>

      {isMfaEnabled ? (
        <>
          {!showDisable ? (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowDisable(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Disable MFA
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">
                Enter your current authenticator code to disable MFA:
              </p>
              <TotpInput value={disableCode} onChange={setDisableCode} />
              {error && <p className="text-xs text-red-700">{error}</p>}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleDisable}
                  isLoading={disableMfa.isPending}
                  disabled={disableCode.length !== 6}
                  className="text-red-600 border-red-300 hover:bg-red-100"
                >
                  Confirm Disable
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowDisable(false); setDisableCode(''); setError(null); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex justify-end">
          <Button onClick={handleStartSetup} isLoading={setupMfa.isPending}>
            Set up MFA
          </Button>
        </div>
      )}
    </div>
  );
}
