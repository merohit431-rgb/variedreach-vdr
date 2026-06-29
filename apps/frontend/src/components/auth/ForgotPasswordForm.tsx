'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';

export function ForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    await forgotPassword(email);
    setIsSubmitting(false);
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <MailCheck className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="mt-4 text-sm text-slate-600">
          If an account exists for <strong className="text-slate-900">{email}</strong>, we&apos;ve
          sent a password reset link to that address.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Forgot password?</h1>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a link to reset it.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>

        <Link href="/login" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
