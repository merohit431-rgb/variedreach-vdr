import { ProvisioningService } from './provisioning.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import type { ConfigService } from '@nestjs/config';
import type { CouponService } from '../coupon/coupon.service';
import type { AuditLogService } from '../audit/audit-log.service';

describe('ProvisioningService email normalization', () => {
  it('provision() normalizes the registration email before creating/reusing the User', async () => {
    // Reject deliberately, right where the User row is created/reused --
    // proves the query args without mocking the rest of the transaction
    // (subscription, payment, invoice, coupon redemption, audit log, email).
    const userFindUnique = jest.fn().mockRejectedValue(new Error('STOP_HERE'));
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(null), // slug is unique on first try
        create: jest.fn().mockResolvedValue({ id: 'org-1' }),
      },
      user: { findUnique: userFindUnique },
    };

    const registrationFindUnique = jest.fn().mockResolvedValue({
      id: 'reg-1',
      email: '  Manthan.Jhaveri@CrawfordBayley.com  ',
      companyName: 'Crawford Bayley',
      fullName: 'Manthan Jhaveri',
      selectedPlan: 'STARTER',
      selectedStorageGb: 5,
      billingCycle: 'MONTHLY',
      verifiedAt: new Date(),
      provisionedAt: null,
      passwordHash: 'hash',
      discountPaisa: 0,
      gatewayOrderId: null,
      couponCode: null,
      gstNumber: null,
      companyAddress: null,
      mobileNumber: null,
    });

    const prisma = {
      registration: { findUnique: registrationFindUnique },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const service = new ProvisioningService(
      prisma,
      {} as MailService,
      {} as ConfigService,
      {} as CouponService,
      {} as AuditLogService,
    );

    await expect(service.provision('reg-1')).rejects.toThrow('STOP_HERE');

    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: 'manthan.jhaveri@crawfordbayley.com' } });
  });
});

describe('ProvisioningService invoice-number contention', () => {
  const registration = {
    id: 'reg-1',
    email: 'x@crawfordbayley.com',
    companyName: 'Crawford Bayley',
    fullName: 'Manthan Jhaveri',
    selectedPlan: 'STARTER',
    selectedStorageGb: 5,
    billingCycle: 'MONTHLY',
    verifiedAt: new Date(),
    provisionedAt: null,
    passwordHash: 'hash',
    discountPaisa: 0,
    gatewayOrderId: null,
    couponCode: null,
    gstNumber: null,
    companyAddress: null,
    mobileNumber: null,
  };

  function buildTx(invoiceCreate: jest.Mock) {
    return {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'org-1' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: registration.email, firstName: 'Manthan', lastName: 'Jhaveri' }),
      },
      organisationMembership: { create: jest.fn().mockResolvedValue({}) },
      subscription: { create: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: invoiceCreate,
      },
      registration: { update: jest.fn().mockResolvedValue({}) },
    };
  }

  function buildService(prisma: PrismaService) {
    return new ProvisioningService(
      prisma,
      { sendSubscriptionActivatedEmail: jest.fn() } as unknown as MailService,
      { get: jest.fn().mockReturnValue('http://frontend.test') } as unknown as ConfigService,
      { redeem: jest.fn() } as unknown as CouponService,
      { record: jest.fn() } as unknown as AuditLogService,
    );
  }

  it('retries the whole transaction once on an invoiceNumber clash and succeeds', async () => {
    const invoiceNumberClash = Object.assign(new Error('Unique constraint failed on the fields: (`invoiceNumber`)'), {
      code: 'P2002',
      meta: { target: ['invoiceNumber'] },
    });
    const invoiceCreate = jest
      .fn()
      .mockRejectedValueOnce(invoiceNumberClash)
      .mockResolvedValueOnce({ id: 'inv-1' });
    const tx = buildTx(invoiceCreate);

    const transactionSpy = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const prisma = {
      registration: { findUnique: jest.fn().mockResolvedValue(registration) },
      $transaction: transactionSpy,
    } as unknown as PrismaService;

    const result = await buildService(prisma).provision('reg-1');

    expect(transactionSpy).toHaveBeenCalledTimes(2);
    expect(invoiceCreate).toHaveBeenCalledTimes(2);
    expect(result.organisationId).toBe('org-1');
  });

  it('does not retry a P2002 on a different field (e.g. paymentId) and surfaces it immediately', async () => {
    const paymentIdClash = Object.assign(new Error('Unique constraint failed on the fields: (`paymentId`)'), {
      code: 'P2002',
      meta: { target: ['paymentId'] },
    });
    const invoiceCreate = jest.fn().mockRejectedValue(paymentIdClash);
    const tx = buildTx(invoiceCreate);

    const transactionSpy = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const prisma = {
      registration: { findUnique: jest.fn().mockResolvedValue(registration) },
      $transaction: transactionSpy,
    } as unknown as PrismaService;

    await expect(buildService(prisma).provision('reg-1')).rejects.toBe(paymentIdClash);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });
});
