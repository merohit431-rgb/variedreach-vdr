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

// Mirrors MANAGER_ROLES / ADMIN_ROLES in the backend's data-rooms.service.ts —
// the roles allowed to manage a data room (create/edit/archive, invite/remove members).
export const DATA_ROOM_MANAGER_ROLES: UserRole[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'RP_LIQUIDATOR'];

export function isDataRoomManager(role: UserRole): boolean {
  return DATA_ROOM_MANAGER_ROLES.includes(role);
}
