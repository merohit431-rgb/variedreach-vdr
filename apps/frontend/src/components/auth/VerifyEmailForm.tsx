'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useRegistration } from '@/hooks/use-registration';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { verifyEmail, resendVerification } = useRegistration();

  const [status, setStatus] = useState<Status>('verifying');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    verifyEmail(token).then((result) => {
      if (result.success) {
        setVerifiedEmail(result.email);
        setStatus('success');
      } else {
        setStatus('error');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleResend(event: FormEvent) {
    event.preventDefault();
    setIsResending(true);
    await resendVerification(resendEmail);
    setIsResending(false);
    setResendSent(true);
  }

  if (status === 'verifying') {
    return <p className="text-center text-sm text-slate-500">Verifying your email…</p>;
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Email verified</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your email address has been confirmed. Complete your subscription to activate your account.
        </p>
        <Link
          href={`/checkout?email=${encodeURIComponent(verifiedEmail)}`}
          className="mt-5 inline-block rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 transition-colors"
        >
          Proceed to Payment
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
        <XCircle className="h-6 w-6 text-rose-600" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Link expired or invalid</h1>
      <p className="mt-2 text-sm text-slate-600">
        This verification link is no longer valid. Enter your email and we&apos;ll send a new one.
      </p>

      {resendSent ? (
        <Alert tone="success" className="mt-4 text-left">
          If that email is registered and not yet verified, a new link is on its way.
        </Alert>
      ) : (
        <form onSubmit={handleResend} className="mt-4 space-y-3 text-left">
          <FormField
            label="Email"
            id="resendEmail"
            type="email"
            autoComplete="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
          />
          <Button type="submit" className="w-full" isLoading={isResending}>
            {isResending ? 'Sending…' : 'Resend verification link'}
          </Button>
        </form>
      )}
    </div>
  );
}
