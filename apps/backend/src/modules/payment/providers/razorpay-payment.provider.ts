import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IPaymentProvider, CreateOrderInput, CreateOrderResult, VerifyPaymentInput } from '../payment-provider.interface';

@Injectable()
export class RazorpayPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(RazorpayPaymentProvider.name);
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(private readonly configService: ConfigService) {
    this.keyId = this.configService.get<string>('payment.keyId')!;
    this.keySecret = this.configService.get<string>('payment.keySecret')!;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    const client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });

    const order = await client.orders.create({
      amount: input.amountPaisa,
      currency: 'INR',
      receipt: input.receipt,
    });

    return { orderId: order.id, amountPaisa: order.amount, keyId: this.keyId };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<boolean> {
    const body = `${input.orderId}|${input.paymentId}`;
    const expected = crypto.createHmac('sha256', this.keySecret).update(body).digest('hex');
    return expected === input.signature;
  }

  async refundPayment(paymentId: string, amountPaisa: number): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    const client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    await client.payments.refund(paymentId, { amount: amountPaisa });
    this.logger.log(`Refunded ${amountPaisa} paise for payment ${paymentId}`);
  }

  // Reconciliation-only -- not part of IPaymentProvider since "compare against
  // the real gateway" is meaningless for the mock provider. Looked up by
  // order (not payment) id because that's the one identifier we always have
  // (set at create-order time), even when gatewayPaymentId never got filled
  // in (the exact drift this exists to catch).
  async fetchOrderPayments(orderId: string): Promise<Array<{ id: string; status: string; amount: number; method: string; createdAt: number }>> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    const client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    const result = await client.orders.fetchPayments(orderId);
    return (result.items ?? []).map((p: { id: string; status: string; amount: number; method: string; created_at: number }) => ({
      id: p.id,
      status: p.status,
      amount: p.amount,
      method: p.method,
      createdAt: p.created_at,
    }));
  }
}
