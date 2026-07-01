import { Suspense } from 'react';
import { CheckoutForm } from '@/components/auth/CheckoutForm';

export const metadata = { title: 'Complete Subscription – VariedReach VDR' };

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutForm />
    </Suspense>
  );
}
