import { UserRole } from '@prisma/client';

// Roles allowed to create/rename/move/delete folders and upload/delete files,
// per the PRD 2.1 permission matrix ("Upload Documents" / "Delete Documents"
// row). Everyone else who is a data room member can still view/download.
export const CONTENT_MANAGER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.RP_LIQUIDATOR,
  UserRole.AUDITOR,
];
