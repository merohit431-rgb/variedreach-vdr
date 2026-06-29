'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { PLAN_IDS, PRICING_PLANS, calculatePricing, type PlanId } from '@variedreach-vdr/shared';
import { useRegistration } from '@/hooks/use-registration';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function resolvePlanId(value: string | null): PlanId {
  return (PLAN_IDS as readonly string[]).includes(value ?? '') ? (value as PlanId) : 'STARTER';
}

export function SignupForm() {
  const searchParams = useSearchParams();
  const { register } = useRegistration();

  const planId = resolvePlanId(searchParams.get('plan'));
  const plan = PRICING_PLANS[planId];
  const requestedStorage = Number(searchParams.get('storage'));
  const storageGb = requestedStorage > 0 ? requestedStorage : plan.minimumStorageGb;
  const pricing = calculatePricing(planId, storageGb);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

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
    const result = await register({
      fullName,
      companyName,
      email,
      mobileNumber,
      password,
      gstNumber: gstNumber || undefined,
      companyAddress: companyAddress || undefined,
      selectedPlan: planId,
      selectedStorageGb: pricing.billableStorageGb,
    });
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
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ve sent a verification link to <span className="font-medium text-slate-900">{email}</span>.
          Click it to confirm your address — we&apos;ll follow up separately about activating your account.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Get started with Varied Reach.</p>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-900">
            {plan.name} · {pricing.billableStorageGb} GB
          </span>
          <Link href="/pricing" className="text-xs font-medium text-brand-700 hover:text-brand-800">
            Change plan
          </Link>
        </div>
        <p className="mt-1 text-slate-600">
          {formatInr(pricing.total)} / month <span className="text-slate-400">(incl. 18% GST)</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField
          label="Full name"
          id="fullName"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <FormField
          label="Company name"
          id="companyName"
          autoComplete="organization"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <FormField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          label="Mobile number"
          id="mobileNumber"
          type="tel"
          autoComplete="tel"
          required
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
        />

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

        <FormField
          label="GST number (optional)"
          id="gstNumber"
          value={gstNumber}
          onChange={(e) => setGstNumber(e.target.value)}
        />

        <FormField
          label="Company address (optional)"
          id="companyAddress"
          value={companyAddress}
          onChange={(e) => setCompanyAddress(e.target.value)}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
