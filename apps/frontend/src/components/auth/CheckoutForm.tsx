'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle2, Tag, X } from 'lucide-react';
import { useRegistration } from '@/hooks/use-registration';
import { useCoupon, type CouponResult } from '@/hooks/use-coupon';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PRICING_PLANS, calculatePricing, type PlanId } from '@variedreach-vdr/shared';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

type BillingCycle = 'MONTHLY' | 'YEARLY';

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { email?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

// Lazy-loaded on first checkout attempt rather than globally — only this page needs it.
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const router = useRouter();
  const { getDetails, createOrder, completeRegistration } = useRegistration();
  const { validate } = useCoupon();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState<PlanId>('STARTER');
  const [storageGb, setStorageGb] = useState(5);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!email) { setError('No email provided.'); setLoading(false); return; }
    getDetails(email).then((res) => {
      if (!res.success) { setError(res.message ?? 'Registration not found.'); setLoading(false); return; }
      setPlanId(res.data.selectedPlan as PlanId);
      setStorageGb(res.data.selectedStorageGb);
      setCycle((res.data.billingCycle as BillingCycle) ?? 'MONTHLY');
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const plan = PRICING_PLANS[planId];
  const breakdown = calculatePricing(planId, storageGb);
  const isYearly = cycle === 'YEARLY';
  // No GST — not registered. Total = base (yearly gets the 10% discount).
  const yearlyBase = Math.round(breakdown.monthlyCharges * 12 * 0.9);
  const displayBase = isYearly ? yearlyBase : breakdown.monthlyCharges;
  // Coupon amounts come from the server in paise; checkout works in rupees.
  const discountRupees = applied ? Math.round(applied.discountPaisa / 100) : 0;
  const finalTotal = applied ? Math.round(applied.finalPaisa / 100) : displayBase;

  function resetCoupon() {
    setApplied(null);
    setCouponError('');
  }

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setApplying(true);
    setCouponError('');
    const res = await validate({ code: couponInput.trim(), planId, storageGb, billingCycle: cycle, email });
    setApplying(false);
    if (!res.success) { setCouponError(res.message ?? 'Could not check that coupon.'); return; }
    if (!res.data.valid) { setApplied(null); setCouponError(res.data.reason ?? 'This coupon is not valid.'); return; }
    setApplied(res.data);
  }

  async function handlePay() {
    setIsSubmitting(true);
    setError('');

    const orderRes = await createOrder(email, cycle, applied?.code);
    if (!orderRes.success) { setError(orderRes.message ?? 'Failed to create order.'); setIsSubmitting(false); return; }

    const scriptOk = await loadRazorpayScript();
    if (!scriptOk || !window.Razorpay) {
      setError('Could not load the payment window. Check your connection and try again.');
      setIsSubmitting(false);
      return;
    }

    const { orderId, amountPaisa, currency, keyId } = orderRes.data;

    const razorpay = new window.Razorpay({
      key: keyId,
      amount: amountPaisa,
      currency,
      name: 'Varied Reach',
      description: `${plan.name} Plan — ${isYearly ? 'Yearly' : 'Monthly'}`,
      order_id: orderId,
      prefill: { email },
      theme: { color: '#083E84' },
      handler: async (response) => {
        const completeRes = await completeRegistration(
          email,
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
        );
        if (!completeRes.success) {
          // Payment was captured by Razorpay at this point — the webhook will
          // provision the account independently even if this call failed
          // (network blip, tab issue), so this isn't a bare failure message.
          setError(completeRes.message ?? 'Payment received — finishing setup. If your dashboard doesn\'t load within a minute, check your email before trying again.');
          setIsSubmitting(false);
          return;
        }
        const { accessToken, user } = completeRes.data;
        setAuth({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role as never, organisationId: user.organisationId }, accessToken);
        router.replace('/dashboard');
      },
      modal: {
        ondismiss: () => { setIsSubmitting(false); },
      },
    });
    razorpay.open();
  }

  if (loading) return <p className="text-center text-sm text-slate-500">Loading your plan details…</p>;

  if (error && !plan) {
    return (
      <div className="text-center">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Complete your subscription</h1>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex rounded-lg border border-slate-200 p-1">
        {(['MONTHLY', 'YEARLY'] as BillingCycle[]).map((c) => (
          <button
            key={c}
            onClick={() => { setCycle(c); resetCoupon(); }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              cycle === c ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c === 'MONTHLY' ? 'Monthly' : 'Yearly'}
            {c === 'YEARLY' && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">–10%</span>}
          </button>
        ))}
      </div>

      {/* Order summary */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
        <div className="flex justify-between text-sm font-medium text-slate-900">
          <span>{plan.name} Plan</span>
          <span>{breakdown.billableStorageGb} GB</span>
        </div>
        <div className="space-y-1 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>{isYearly ? '12 months × monthly rate × 0.9' : 'Monthly charges'}</span>
            <span>{formatInr(displayBase)}</span>
          </div>
          {applied && (
            <div className="flex justify-between text-emerald-700">
              <span>Coupon {applied.code}</span>
              <span>− {formatInr(discountRupees)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total due now</span>
          <span>{formatInr(finalTotal)}{isYearly ? ' / year' : ' / month'}</span>
        </div>
      </div>

      {/* Coupon */}
      <div>
        {applied ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Tag className="h-4 w-4" aria-hidden="true" />
              {applied.code} applied
            </span>
            <button
              onClick={() => { resetCoupon(); setCouponInput(''); }}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                placeholder="Coupon code"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <Button variant="secondary" onClick={handleApplyCoupon} isLoading={applying} disabled={!couponInput.trim()}>
              Apply
            </Button>
          </div>
        )}
        {couponError && <p className="mt-1.5 text-xs text-rose-600">{couponError}</p>}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="space-y-3">
        <Button className="w-full" onClick={handlePay} isLoading={isSubmitting}>
          {isSubmitting ? 'Processing…' : (
            <span className="flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" />
              {`Pay ${formatInr(finalTotal)} and Activate`}
            </span>
          )}
        </Button>
        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Secure payment · Instant account activation
        </p>
      </div>
    </div>
  );
}
