import type { Subscription } from '@prisma/client';

// Orgs with no subscription row at all (manually provisioned before
// self-service billing existed, or internal/test orgs) are NOT blocked by
// this check -- subscription-based access control is opt-in per org: it
// only starts applying once a subscription actually exists, and only then
// does it matter whether that subscription has lapsed. This is deliberate:
// blanket-blocking "no subscription" would immediately lock out every
// legacy-provisioned organisation the moment this shipped, which is exactly
// the outage this check exists to prevent, not cause.
export function isSubscriptionLapsed(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'ACTIVE') return true;
  return subscription.currentPeriodEnd < new Date();
}
