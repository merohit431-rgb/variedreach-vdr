import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';

@Global()
@Module({
  providers: [
    MockPaymentProvider,
    RazorpayPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService, mock: MockPaymentProvider, razorpay: RazorpayPaymentProvider) =>
        config.get<string>('payment.provider') === 'razorpay' ? razorpay : mock,
      inject: [ConfigService, MockPaymentProvider, RazorpayPaymentProvider],
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
