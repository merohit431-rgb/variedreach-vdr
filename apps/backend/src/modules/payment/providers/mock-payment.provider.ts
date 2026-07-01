import { Injectable, Logger } from '@nestjs/common';
import { IPaymentProvider, CreateOrderInput, CreateOrderResult, VerifyPaymentInput } from '../payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const orderId = `order_mock_${Date.now()}`;
    this.logger.log(`[MOCK] Created order ${orderId} for ${input.amountPaisa} paise`);
    return { orderId, amountPaisa: input.amountPaisa, keyId: 'mock_key_id' };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<boolean> {
    this.logger.log(`[MOCK] Verified payment ${input.paymentId} for order ${input.orderId}`);
    return true;
  }

  async refundPayment(paymentId: string, amountPaisa: number): Promise<void> {
    this.logger.log(`[MOCK] Refunded ${amountPaisa} paise for payment ${paymentId}`);
  }
}
