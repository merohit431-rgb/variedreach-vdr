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
}
