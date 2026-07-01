'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { useRegistration } from '@/hooks/use-registration';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PRICING_PLANS, calculatePricing, type PlanId } from '@variedreach-vdr/shared';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

type BillingCycle = 'MONTHLY' | 'YEARLY';

export function CheckoutForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const router = useRouter();
  const { getDetails, createOrder, completeRegistration } = useRegistration();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState<PlanId>('STARTER');
  const [storageGb, setStorageGb] = useState(5);
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const yearlyBase = Math.round(breakdown.monthlyCharges * 12 * 0.9);
  const yearlyGst = Math.round(yearlyBase * 0.18);
  const yearlyTotal = yearlyBase + yearlyGst;
  const displayBase = isYearly ? yearlyBase : breakdown.monthlyCharges;
  const displayGst = isYearly ? yearlyGst : breakdown.gst;
  const displayTotal = isYearly ? yearlyTotal : breakdown.total;

  async function handlePay() {
    setIsSubmitting(true);
    setError('');

    const orderRes = await createOrder(email, cycle);
    if (!orderRes.success) { setError(orderRes.message ?? 'Failed to create order.'); setIsSubmitting(false); return; }

    const { orderId } = orderRes.data;
    const paymentId = `pay_mock_${Date.now()}`;
    const signature = 'mock_signature';

    const completeRes = await completeRegistration(email, orderId, paymentId, signature);
    if (!completeRes.success) { setError(completeRes.message ?? 'Payment failed.'); setIsSubmitting(false); return; }

    const { accessToken, user } = completeRes.data;
    setAuth({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role as never, organisationId: user.organisationId }, accessToken);
    router.replace('/dashboard');
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
            onClick={() => setCycle(c)}
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
          <div className="flex justify-between">
            <span>GST (18%)</span>
            <span>{formatInr(displayGst)}</span>
          </div>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total due now</span>
          <span>{formatInr(displayTotal)}{isYearly ? ' / year' : ' / month'}</span>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="space-y-3">
        <Button className="w-full" onClick={handlePay} isLoading={isSubmitting}>
          {isSubmitting ? 'Processing…' : (
            <span className="flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" />
              {`Pay ${formatInr(displayTotal)} and Activate`}
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
