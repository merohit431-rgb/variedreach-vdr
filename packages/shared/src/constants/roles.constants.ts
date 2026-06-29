// Mirrors the UserRole enum in apps/backend/prisma/schema.prisma.
// Kept here too so the frontend can reference roles without depending on @prisma/client.
export const USER_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'RP_LIQUIDATOR',
  'PRA',
  'COC_MEMBER',
  'AUDITOR',
  'LEGAL_ADVISOR',
  'GUEST',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Organization Admin',
  RP_LIQUIDATOR: 'RP / Liquidator',
  PRA: 'Prospective Resolution Applicant',
  COC_MEMBER: 'CoC Member',
  AUDITOR: 'Auditor',
  LEGAL_ADVISOR: 'Legal Advisor',
  GUEST: 'Guest User',
};

// Mirrors EXTERNAL_ROLES in apps/backend/src/common/constants/content-roles.ts
// — keep these two lists in lockstep. Frontend conditional rendering only
// (hide a tab, show an empty state); never the actual security boundary —
// every endpoint these roles are restricted from must also enforce it
// server-side independently of this list.
export const EXTERNAL_ROLES: UserRole[] = ['PRA', 'COC_MEMBER', 'AUDITOR', 'LEGAL_ADVISOR', 'GUEST'];
