import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  provider: process.env.PAYMENT_PROVIDER || 'mock',
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
}));
