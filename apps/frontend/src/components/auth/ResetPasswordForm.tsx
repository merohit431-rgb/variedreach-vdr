'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { resetPassword } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset link is missing a token. Request a new one.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      setError(
        'Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character.',
      );
      return;
    }

    setIsSubmitting(true);
    const result = await resetPassword(token, newPassword);
    setIsSubmitting(false);

    if (result.success) {
      router.push('/login');
    } else {
      setError(result.message);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Reset password</h1>
      <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField
          label="New password"
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="At least 10 characters, with uppercase, lowercase, a number, and a special character."
        />

        <FormField
          label="Confirm new password"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>

        <Link href="/login" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
