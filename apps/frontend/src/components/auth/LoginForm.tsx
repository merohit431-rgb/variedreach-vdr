'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVerifyMfaLogin, useVerifyEmailOtpLogin, useResendEmailOtp } from '@/hooks/use-mfa';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/store/auth-store';
import { extractErrorMessage } from '@/lib/error-message';

const RESEND_COOLDOWN_SECONDS = 30;

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { setAuth } = useAuthStore();
  const verifyMfaLogin = useVerifyMfaLogin();
  const verifyEmailOtpLogin = useVerifyEmailOtpLogin();
  const resendEmailOtp = useResendEmailOtp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<'EMAIL_OTP' | 'TOTP'>('EMAIL_OTP');
  const [totpCode, setTotpCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login({ email, password, rememberMe });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    if (result.requiresMfa) {
      setMfaChallengeToken(result.mfaChallengeToken);
      setMfaMethod(result.mfaMethod ?? 'EMAIL_OTP');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      return;
    }

    const role = useAuthStore.getState().user?.role;
    router.push(role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/dashboard');
  }

  async function handleTotpSubmit(event: FormEvent) {
    event.preventDefault();
    if (!mfaChallengeToken) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await verifyMfaLogin.mutateAsync({ mfaChallengeToken, totpCode, rememberMe });
      setAuth(data.user as Parameters<typeof setAuth>[0], data.accessToken);
      const role = data.user.role;
      router.push(role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent) {
    event.preventDefault();
    if (!mfaChallengeToken) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await verifyEmailOtpLogin.mutateAsync({
        mfaChallengeToken,
        code: otpCode,
        rememberMe,
        trustDevice,
      });
      setAuth(data.user as Parameters<typeof setAuth>[0], data.accessToken);
      const role = data.user.role;
      router.push(role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!mfaChallengeToken || resendCooldown > 0) return;
    setError(null);
    setResendMessage(null);
    try {
      const data = await resendEmailOtp.mutateAsync(mfaChallengeToken);
      setMfaChallengeToken(data.mfaChallengeToken);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendMessage('A new code has been sent to your email.');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  function handleBackToSignIn() {
    setMfaChallengeToken(null);
    setTotpCode('');
    setOtpCode('');
    setError(null);
    setResendMessage(null);
  }

  if (mfaChallengeToken && mfaMethod === 'TOTP') {
    return (
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          <h1 className="text-lg font-semibold text-slate-900">Two-factor authentication</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleTotpSubmit} className="mt-6 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-slate-700">
              Authenticator code
            </label>
            <Input
              id="totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="mt-1.5 tracking-widest text-center text-lg font-mono"
              autoFocus
            />
          </div>

          <Button type="submit" className="h-12 w-full" size="lg" isLoading={isSubmitting}
            disabled={totpCode.length !== 6 || isSubmitting}>
            Verify
          </Button>

          <button
            type="button"
            onClick={handleBackToSignIn}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  if (mfaChallengeToken) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-brand-600" />
          <h1 className="text-lg font-semibold text-slate-900">Check your email</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          We sent a 6-digit verification code to <span className="font-medium text-slate-700">{email}</span>.
        </p>

        <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {resendMessage && !error && <Alert tone="success">{resendMessage}</Alert>}

          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-slate-700">
              Verification code
            </label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="mt-1.5 tracking-widest text-center text-lg font-mono"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Trust this device for 30 days
          </label>

          <Button type="submit" className="h-12 w-full" size="lg" isLoading={isSubmitting}
            disabled={otpCode.length !== 6 || isSubmitting}>
            Verify
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleBackToSignIn}
              className="text-slate-500 hover:text-slate-700"
            >
              Back to sign in
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to access your data rooms.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="h-12 w-full" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
