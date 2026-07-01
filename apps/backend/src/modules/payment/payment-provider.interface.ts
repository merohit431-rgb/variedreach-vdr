export interface CreateOrderInput {
  amountPaisa: number;
  receipt: string;
}

export interface CreateOrderResult {
  orderId: string;
  amountPaisa: number;
  keyId: string;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

// Two implementations: MockPaymentProvider (staging, no external calls) and
// RazorpayPaymentProvider (production, real Razorpay API). Picked once at boot
// in payment.module.ts based on PAYMENT_PROVIDER env var.
export interface IPaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<boolean>;
  refundPayment(paymentId: string, amountPaisa: number): Promise<void>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
