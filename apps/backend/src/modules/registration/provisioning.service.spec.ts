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
