import { isSubscriptionLapsed } from './subscription.util';
import type { Subscription } from '@prisma/client';

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub-1',
    organisationId: 'org-1',
    planSlug: 'STARTER',
    billingCycle: 'YEARLY',
    storageGb: 12,
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2099-01-01'),
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Subscription;
}

describe('isSubscriptionLapsed', () => {
  it('never blocks an organisation with no subscription row at all', () => {
    expect(isSubscriptionLapsed(null)).toBe(false);
  });

  it('is not lapsed when ACTIVE and the period end is in the future', () => {
    expect(isSubscriptionLapsed(sub({ status: 'ACTIVE', currentPeriodEnd: new Date('2099-01-01') }))).toBe(false);
  });

  it('is lapsed when the period end is in the past, even if status still says ACTIVE', () => {
    expect(isSubscriptionLapsed(sub({ status: 'ACTIVE', currentPeriodEnd: new Date('2020-01-01') }))).toBe(true);
  });

  it('is lapsed when explicitly CANCELLED, even if the period has not technically ended', () => {
    expect(isSubscriptionLapsed(sub({ status: 'CANCELLED', currentPeriodEnd: new Date('2099-01-01') }))).toBe(true);
  });

  it('is lapsed for PAST_DUE and EXPIRED regardless of dates', () => {
    expect(isSubscriptionLapsed(sub({ status: 'PAST_DUE' }))).toBe(true);
    expect(isSubscriptionLapsed(sub({ status: 'EXPIRED' }))).toBe(true);
  });
});
