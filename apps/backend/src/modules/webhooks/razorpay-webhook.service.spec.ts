import * as crypto from 'crypto';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { AuditLogService } from '../audit/audit-log.service';
import type { MailService } from '../mail/mail.service';
import type { ProvisioningService } from '../registration/provisioning.service';

function sign(secret: string, body: Buffer): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('RazorpayWebhookService idempotency-marker rollback', () => {
  it('deletes the just-created webhookEvent row when the handler fails, so a Razorpay retry is reprocessed instead of silently dropped as a duplicate', async () => {
    const secret = 'test-webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 100000 } } },
    };
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = sign(secret, rawBody);

    const webhookEventDelete = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      webhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'wh-1' }),
        delete: webhookEventDelete,
      },
      registration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'reg-1', provisionedAt: null }),
      },
      payment: { findUnique: jest.fn() },
    } as unknown as PrismaService;

    const configService = { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
    // A transient failure (DB blip, etc.), not the benign "another path
    // already provisioned this" race -- must propagate, not be swallowed.
    const provisioningService = {
      provision: jest.fn().mockRejectedValue(new Error('DB blip')),
    } as unknown as ProvisioningService;

    const service = new RazorpayWebhookService(configService, prisma, {} as AuditLogService, {} as MailService, provisioningService);

    await expect(service.handle(rawBody, { 'x-razorpay-signature': signature })).rejects.toThrow('DB blip');

    expect(webhookEventDelete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
  });

  it('keeps the webhookEvent row when the handler succeeds, so a real duplicate delivery is skipped', async () => {
    const secret = 'test-webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 100000 } } },
    };
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = sign(secret, rawBody);

    const webhookEventDelete = jest.fn();
    const prisma = {
      webhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'wh-1' }),
        delete: webhookEventDelete,
      },
      registration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'reg-1', provisionedAt: null }),
      },
    } as unknown as PrismaService;

    const configService = { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
    const provisioningService = {
      provision: jest.fn().mockResolvedValue({ organisationId: 'org-1' }),
    } as unknown as ProvisioningService;

    const service = new RazorpayWebhookService(configService, prisma, {} as AuditLogService, {} as MailService, provisioningService);

    await service.handle(rawBody, { 'x-razorpay-signature': signature });

    expect(webhookEventDelete).not.toHaveBeenCalled();
  });
});
