import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProvisioningService } from '../registration/provisioning.service';

// Mirror of the display-name half of packages/shared/src/constants/pricing.constants.ts
// (same duplication pattern as registration.service.ts / provisioning.service.ts --
// the shared package ships raw TS with no build step so it can't be imported here).
const PLAN_NAMES: Record<string, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  BUSINESS: 'Business',
};

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount?: number;
  error_code?: string;
  error_description?: string;
}

interface RazorpayRefundEntity {
  id: string;
  payment_id: string;
  amount?: number;
}

@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
    private readonly provisioningService: ProvisioningService,
  ) {}

  // Signature (not JWT) is the real security boundary here, same convention
  // as ResendWebhookService -- a bad signature becomes a 400 (Razorpay won't
  // retry a request it thinks is malformed), never a 500.
  async handle(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<void> {
    this.verifySignature(rawBody, this.headerString(headers['x-razorpay-signature']));

    let body: { event?: string; payload?: Record<string, { entity?: unknown }> };
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed webhook payload');
    }

    const eventType = body.event;
    if (!eventType) {
      this.logger.warn('Razorpay webhook missing event type');
      return;
    }

    const entity = this.extractEntity(body, eventType);
    if (!entity || typeof (entity as { id?: unknown }).id !== 'string') {
      this.logger.warn(`Razorpay webhook ${eventType} missing a usable entity id -- ignoring`);
      return;
    }
    const externalId = (entity as { id: string }).id;

    // Idempotency: Razorpay retries webhook delivery on anything but a
    // prompt 2xx, so the same (provider, externalId, eventType) can arrive
    // more than once. Insert-or-skip via the unique constraint -- a
    // duplicate is not an error, it's Razorpay confirming what we already know.
    try {
      await this.prisma.webhookEvent.create({
        data: { provider: 'razorpay', eventType, externalId, payload: body as object },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        this.logger.log(`Duplicate Razorpay webhook ${eventType}/${externalId} -- already processed, skipping`);
        return;
      }
      throw error;
    }

    switch (eventType) {
      case 'payment.captured':
        await this.handlePaymentCaptured(entity as RazorpayPaymentEntity);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(entity as RazorpayPaymentEntity);
        break;
      case 'refund.processed':
        await this.handleRefundProcessed(entity as RazorpayRefundEntity);
        break;
      default:
        this.logger.debug(`Ignoring unhandled Razorpay webhook event: ${eventType}`);
    }
  }

  // Closes the gap where a customer pays but never redirects back to
  // /registration/complete (closed tab, dropped connection, etc.) -- without
  // this, Razorpay would have captured real money with no record of it here.
  // If the client-redirect path already provisioned first, this just
  // backfills Payment.gatewayPaymentId (never written anywhere before now)
  // and stays a no-op otherwise.
  private async handlePaymentCaptured(entity: RazorpayPaymentEntity): Promise<void> {
    if (!entity.order_id) {
      this.logger.warn(`payment.captured ${entity.id} has no order_id -- ignoring`);
      return;
    }

    const registration = await this.prisma.registration.findFirst({
      where: { gatewayOrderId: entity.order_id },
    });
    if (!registration) {
      this.logger.warn(`payment.captured for unknown order ${entity.order_id} (payment ${entity.id})`);
      return;
    }

    if (registration.provisionedAt) {
      const payment = await this.prisma.payment.findUnique({ where: { gatewayOrderId: entity.order_id } });
      if (payment && !payment.gatewayPaymentId) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { gatewayPaymentId: entity.id },
        });
      }
      await this.auditLogService.record({
        action: 'PAYMENT_CAPTURED',
        metadata: { orderId: entity.order_id, paymentId: entity.id, amountPaisa: entity.amount, viaWebhook: true, alreadyProvisioned: true },
      });
      return;
    }

    try {
      await this.provisioningService.provision(registration.id, { paymentId: entity.id });
      this.logger.log(`Provisioned registration ${registration.id} via Razorpay webhook (order ${entity.order_id})`);
      await this.auditLogService.record({
        action: 'PAYMENT_CAPTURED',
        metadata: { orderId: entity.order_id, paymentId: entity.id, amountPaisa: entity.amount, viaWebhook: true, rescuedProvisioning: true },
      });
    } catch (error) {
      // A concurrent client-redirect completion can win the race between
      // our provisionedAt check above and this call -- that's success via
      // the other path, not a failure, so treat it as benign.
      if ((error as Error).message?.includes('Already provisioned')) {
        const payment = await this.prisma.payment.findUnique({ where: { gatewayOrderId: entity.order_id } });
        if (payment && !payment.gatewayPaymentId) {
          await this.prisma.payment.update({ where: { id: payment.id }, data: { gatewayPaymentId: entity.id } });
        }
        return;
      }
      this.logger.error(`Webhook-triggered provisioning failed for registration ${registration.id}: ${(error as Error).message}`);
      throw error;
    }
  }

  private async handlePaymentFailed(entity: RazorpayPaymentEntity): Promise<void> {
    if (!entity.order_id) return;

    const registration = await this.prisma.registration.findFirst({
      where: { gatewayOrderId: entity.order_id },
    });
    // No registration, or it already succeeded via another event/path --
    // nothing to reconcile.
    if (!registration || registration.provisionedAt) return;

    await this.auditLogService.record({
      action: 'PAYMENT_FAILED',
      metadata: {
        orderId: entity.order_id,
        paymentId: entity.id,
        errorCode: entity.error_code,
        errorDescription: entity.error_description,
      },
    });

    const planName = PLAN_NAMES[registration.selectedPlan] ?? registration.selectedPlan;
    void this.mailService.sendPaymentFailedEmail(registration.email, registration.fullName, planName, {
      reason: entity.error_description,
    });
  }

  private async handleRefundProcessed(entity: RazorpayRefundEntity): Promise<void> {
    if (!entity.payment_id) return;

    const payment = await this.prisma.payment.findUnique({ where: { gatewayPaymentId: entity.payment_id } });
    if (!payment) {
      this.logger.warn(`refund.processed for unknown payment ${entity.payment_id} (refund ${entity.id})`);
      return;
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    await this.auditLogService.record({
      action: 'PAYMENT_REFUNDED',
      resourceType: 'Payment',
      resourceId: payment.id,
      metadata: { refundId: entity.id, paymentId: entity.payment_id, amountPaisa: entity.amount },
    });
  }

  private extractEntity(body: { payload?: Record<string, { entity?: unknown }> }, eventType: string): unknown {
    const resource = eventType.split('.')[0]; // "payment.captured" -> "payment"
    return body.payload?.[resource]?.entity;
  }

  private verifySignature(rawBody: Buffer, signature: string): void {
    if (!signature) {
      throw new BadRequestException('Missing Razorpay webhook signature');
    }
    const secret = this.configService.get<string>('payment.webhookSecret');
    if (!secret) {
      // Fails closed -- an unconfigured secret must never be treated as "any
      // signature is valid".
      this.logger.error('RAZORPAY_WEBHOOK_SECRET is not configured -- rejecting webhook');
      throw new BadRequestException('Webhook not configured');
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    const valid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
    if (!valid) {
      this.logger.warn('Rejected Razorpay webhook with invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  private headerString(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
  }
}
