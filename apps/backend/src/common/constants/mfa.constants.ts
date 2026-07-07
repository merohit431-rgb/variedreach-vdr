import { UserRole } from '@prisma/client';

// Two-factor auth is compulsory for these roles regardless of their
// User.emailOtpEnabled flag — they hold organisation-wide or platform-wide
// access. Every other role may opt in for themselves.
export const MANDATORY_MFA_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

export function isMfaRequiredForUser(user: { role: UserRole; emailOtpEnabled: boolean }): boolean {
  return MANDATORY_MFA_ROLES.includes(user.role) || user.emailOtpEnabled;
}
