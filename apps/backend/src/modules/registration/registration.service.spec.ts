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
