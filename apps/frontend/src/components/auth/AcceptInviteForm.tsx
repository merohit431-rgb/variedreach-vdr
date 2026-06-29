'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

export function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { acceptInvite } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Invite link is missing a token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!STRONG_PASSWORD_REGEX.test(password)) {
      setError(
        'Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character.',
      );
      return;
    }

    setIsSubmitting(true);
    const result = await acceptInvite(token, password);
    setIsSubmitting(false);

    if (result.success) {
      setIsDone(true);
    } else {
      setError(result.message);
    }
  }

  if (isDone) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="mt-4 text-sm text-slate-600">Your account is ready. You can now sign in.</p>
        <Button onClick={() => router.push('/login')} className="mt-4 w-full" size="lg">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Activate your account</h1>
      <p className="mt-1 text-sm text-slate-500">Set a password to get started.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField
          label="Password"
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 10 characters, with uppercase, lowercase, a number, and a special character."
        />

        <FormField
          label="Confirm password"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Activating…' : 'Activate account'}
        </Button>

        <Link href="/login" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
