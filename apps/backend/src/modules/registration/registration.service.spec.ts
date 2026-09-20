import { ConflictException } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '../mail/mail.service';
import type { AuthService } from '../auth/auth.service';
import type { IPaymentProvider } from '../payment/payment-provider.interface';
import type { ProvisioningService } from './provisioning.service';
import type { CouponService } from '../coupon/coupon.service';
import type { CreateRegistrationDto } from './dto/create-registration.dto';
import type { CreateOrderDto } from './dto/create-order.dto';

describe('RegistrationService email normalization', () => {
  it('register() normalizes a mixed-case, padded email before the uniqueness check', async () => {
    // Resolve truthy -- an "already registered" hit -- so register() throws
    // right after the query, without needing to mock registration.create().
    const findUnique = jest.fn().mockResolvedValue({ id: 'existing-reg' });
    const prisma = { registration: { findUnique } } as unknown as PrismaService;

    const service = new RegistrationService(
      prisma,
      {} as ConfigService,
      {} as MailService,
      {} as AuthService,
      {} as IPaymentProvider,
      {} as ProvisioningService,
      {} as CouponService,
    );

    const dto = {
      email: '  Manthan.Jhaveri@CrawfordBayley.com  ',
      fullName: 'Manthan Jhaveri',
      companyName: 'Crawford Bayley',
      mobileNumber: '9999999999',
      password: 'Str0ng!Passw0rd',
      selectedPlan: 'STARTER',
      selectedStorageGb: 5,
    } as CreateRegistrationDto;

    await expect(service.register(dto)).rejects.toThrow(ConflictException);

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'manthan.jhaveri@crawfordbayley.com' } });
  });
});

describe('RegistrationService.createOrder idempotency', () => {
  it('reuses the stored gatewayOrderId instead of minting a second order when billingCycle/couponCode are unchanged', async () => {
    const registration = {
      id: 'reg-1',
      email: 'x@crawfordbayley.com',
      selectedPlan: 'STARTER',
      selectedStorageGb: 5,
      verifiedAt: new Date(),
      provisionedAt: null,
      gatewayOrderId: 'order_existing',
      billingCycle: 'MONTHLY',
      couponCode: null,
      discountPaisa: 0,
    };
    const findUnique = jest.fn().mockResolvedValue(registration);
    const update = jest.fn();
    const prisma = { registration: { findUnique, update } } as unknown as PrismaService;

    const createOrder = jest.fn();
    const getKeyId = jest.fn().mockReturnValue('key_test');
    const paymentProvider = { createOrder, getKeyId } as unknown as IPaymentProvider;

    const service = new RegistrationService(
      prisma,
      {} as ConfigService,
      {} as MailService,
      {} as AuthService,
      paymentProvider,
      {} as ProvisioningService,
      {} as CouponService,
    );

    const dto = { email: registration.email, billingCycle: 'MONTHLY' } as CreateOrderDto;
    const result = await service.createOrder(dto);

    // No new gateway order minted, and gatewayOrderId never overwritten --
    // otherwise a capture against the original order would find no
    // registration (handlePaymentCaptured looks it up BY gatewayOrderId)
    // and the customer's payment would never get provisioned.
    expect(createOrder).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result.orderId).toBe('order_existing');
    expect(result.amountPaisa).toBe(2_499_500); // 5GB * ₹4999/GB * 100 (STARTER, monthly, no discount)
  });

  it('mints a fresh order when the billing cycle differs from what is stored', async () => {
    const registration = {
      id: 'reg-1',
      email: 'x@crawfordbayley.com',
      selectedPlan: 'STARTER',
      selectedStorageGb: 5,
      verifiedAt: new Date(),
      provisionedAt: null,
      gatewayOrderId: 'order_existing',
      billingCycle: 'MONTHLY',
      couponCode: null,
      discountPaisa: 0,
    };
    const findUnique = jest.fn().mockResolvedValue(registration);
    const update = jest.fn().mockResolvedValue(registration);
    const prisma = { registration: { findUnique, update } } as unknown as PrismaService;

    const createOrder = jest.fn().mockResolvedValue({ orderId: 'order_new', amountPaisa: 26_994_600, keyId: 'key_test' });
    const paymentProvider = { createOrder, getKeyId: jest.fn() } as unknown as IPaymentProvider;

    const service = new RegistrationService(
      prisma,
      {} as ConfigService,
      {} as MailService,
      {} as AuthService,
      paymentProvider,
      {} as ProvisioningService,
      {} as CouponService,
    );

    const dto = { email: registration.email, billingCycle: 'YEARLY' } as CreateOrderDto;
    const result = await service.createOrder(dto);

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: 'reg-1' }, data: { gatewayOrderId: 'order_new', billingCycle: 'YEARLY', couponCode: null, discountPaisa: 0 } });
    expect(result.orderId).toBe('order_new');
  });
});

describe('RegistrationService.adminProvision', () => {
  const dto = {
    fullName: 'Manthan Jhaveri',
    companyName: 'Crawford Bayley',
    email: 'Admin.Invoice@CrawfordBayley.com',
    mobileNumber: '9999999999',
    selectedPlan: 'STARTER',
    selectedStorageGb: 20,
    billingCycle: 'YEARLY',
    poNumber: 'PO-1234',
  } as import('./dto/admin-provision-org.dto').AdminProvisionOrgDto;

  it('rejects an email that already has a registration', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'existing-reg' });
    const prisma = { registration: { findUnique } } as unknown as PrismaService;
    const service = new RegistrationService(
      prisma, {} as ConfigService, {} as MailService, {} as AuthService,
      {} as IPaymentProvider, {} as ProvisioningService, {} as CouponService,
    );

    await expect(service.adminProvision(dto, 'super-admin-1')).rejects.toThrow(ConflictException);
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'admin.invoice@crawfordbayley.com' } });
  });

  it('creates a pre-verified registration and provisions immediately with invoiceMeta, then sends a password-reset email instead of a verification one', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'reg-1' });
    const prisma = {
      registration: { findUnique: jest.fn().mockResolvedValue(null), create },
    } as unknown as PrismaService;
    const provision = jest.fn().mockResolvedValue({ organisationId: 'org-1', userId: 'user-1' });
    const forgotPassword = jest.fn().mockResolvedValue(undefined);

    const service = new RegistrationService(
      prisma, {} as ConfigService, { sendEmailVerificationEmail: jest.fn() } as unknown as MailService,
      { forgotPassword } as unknown as AuthService, {} as IPaymentProvider,
      { provision } as unknown as ProvisioningService, {} as CouponService,
    );

    const result = await service.adminProvision(dto, 'super-admin-1');

    const createArgs = create.mock.calls[0][0].data;
    expect(createArgs.verifiedAt).toBeInstanceOf(Date);
    expect(createArgs.billingCycle).toBe('YEARLY');
    expect(createArgs.email).toBe('admin.invoice@crawfordbayley.com');

    expect(provision).toHaveBeenCalledWith('reg-1', undefined, {
      invoicedByUserId: 'super-admin-1',
      poNumber: 'PO-1234',
      notes: undefined,
    });
    expect(forgotPassword).toHaveBeenCalledWith('admin.invoice@crawfordbayley.com');
    expect(result).toEqual({ organisationId: 'org-1', userId: 'user-1' });
  });
});
