import { UserRole } from '@prisma/client';

// Per the PRD 2.1 Permission Matrix exactly:
//   Upload Documents:   Super Admin, Org Admin, RP/Liquidator, Auditor
//   Delete Documents:   Super Admin, Org Admin, RP/Liquidator        (NOT Auditor)
//   Download:           everyone except Guest (Guest is view-only)
// Folder create/rename/move follows the upload tier; folder delete follows
// the delete tier — the matrix doesn't list folders separately from
// "documents", so both content types share the same two tiers.
export const CONTENT_MANAGER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.RP_LIQUIDATOR,
  UserRole.AUDITOR,
];

export const CONTENT_DELETE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.RP_LIQUIDATOR,
];

export const NO_DOWNLOAD_ROLES: UserRole[] = [UserRole.GUEST];

// "Manage Users" / data room administration tier (Create Data Room, Manage
// Users, Export Audit Log rows in the matrix) — Super Admin and Org Admin
// org-wide, RP/Liquidator scoped to data rooms they're a member of.
export const DATA_ROOM_MANAGER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.RP_LIQUIDATOR,
];

// SUPER_ADMIN is a platform-wide title, not a per-data-room membership role —
// excluded from what a room manager can invite/assign so a roleOverride can
// never claim it. (Doesn't currently unlock anything beyond RP_LIQUIDATOR
// against the checks above, but would the moment any check distinguishes
// SUPER_ADMIN specifically — e.g. future billing features — so it's closed
// off at the input boundary now rather than relied on staying harmless.)
export const ASSIGNABLE_MEMBER_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.RP_LIQUIDATOR,
  UserRole.PRA,
  UserRole.COC_MEMBER,
  UserRole.AUDITOR,
  UserRole.LEGAL_ADVISOR,
  UserRole.GUEST,
];
