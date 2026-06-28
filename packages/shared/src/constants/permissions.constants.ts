import { UserRole } from './roles.constants';

// Mirrors the PRD 2.1 Permission Matrix exactly — kept as static reference
// data for the "Roles & Permissions" screen. Actual enforcement lives
// server-side (see apps/backend/src/common/constants/content-roles.ts and
// DataRoomAccessService); this is what's shown to users, not what's checked.
export interface RoleProfile {
  role: UserRole;
  description: string;
  typicalUser: string;
}

export const ROLE_PROFILES: RoleProfile[] = [
  {
    role: 'SUPER_ADMIN',
    description: 'Platform owner. Manages all organisations, billing, and subscriptions.',
    typicalUser: 'Vendor / SaaS operator',
  },
  {
    role: 'ORG_ADMIN',
    description: 'Manages one client organisation. Creates data rooms and users.',
    typicalUser: 'Senior CA / CS partner',
  },
  {
    role: 'RP_LIQUIDATOR',
    description: 'Resolution Professional assigned to a specific case. Full control of that data room.',
    typicalUser: 'IRP / RP / Liquidator',
  },
  {
    role: 'PRA',
    description: 'Prospective Resolution Applicant. Bidder in a CIRP process.',
    typicalUser: 'Bidding company / PE fund',
  },
  {
    role: 'COC_MEMBER',
    description: 'Financial creditor on the Committee of Creditors.',
    typicalUser: 'Bank / NBFC representative',
  },
  {
    role: 'AUDITOR',
    description: 'CA / CS / Statutory Auditor performing financial due diligence.',
    typicalUser: 'External CA firm',
  },
  {
    role: 'LEGAL_ADVISOR',
    description: 'Lawyer conducting legal due diligence.',
    typicalUser: 'Advocate / law firm',
  },
  {
    role: 'GUEST',
    description: 'One-time or time-limited access for third parties.',
    typicalUser: 'Valuer, court-appointed expert',
  },
];

export type PermissionKey =
  | 'CREATE_DATA_ROOM'
  | 'UPLOAD_DOCUMENTS'
  | 'VIEW_DOCUMENTS'
  | 'DOWNLOAD_WATERMARKED'
  | 'DELETE_DOCUMENTS'
  | 'MANAGE_USERS'
  | 'EXPORT_AUDIT_LOG';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  CREATE_DATA_ROOM: 'Create Data Room',
  UPLOAD_DOCUMENTS: 'Upload Documents',
  VIEW_DOCUMENTS: 'View Documents',
  DOWNLOAD_WATERMARKED: 'Download (watermarked)',
  DELETE_DOCUMENTS: 'Delete Documents',
  MANAGE_USERS: 'Manage Users',
  EXPORT_AUDIT_LOG: 'Export Audit Log',
};

// true | false | 'partial' (e.g. RP/Liquidator manages users within their own data room only)
export const PERMISSION_MATRIX: Record<PermissionKey, Record<UserRole, boolean | 'partial'>> = {
  CREATE_DATA_ROOM: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: true,
    COC_MEMBER: false,
    PRA: false,
    AUDITOR: false,
    LEGAL_ADVISOR: false,
    GUEST: false,
  },
  UPLOAD_DOCUMENTS: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: true,
    COC_MEMBER: false,
    PRA: false,
    AUDITOR: true,
    LEGAL_ADVISOR: false,
    GUEST: false,
  },
  VIEW_DOCUMENTS: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: true,
    COC_MEMBER: true,
    PRA: true,
    AUDITOR: true,
    LEGAL_ADVISOR: true,
    GUEST: true,
  },
  DOWNLOAD_WATERMARKED: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: true,
    COC_MEMBER: true,
    PRA: true,
    AUDITOR: true,
    LEGAL_ADVISOR: true,
    GUEST: false,
  },
  DELETE_DOCUMENTS: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: true,
    COC_MEMBER: false,
    PRA: false,
    AUDITOR: false,
    LEGAL_ADVISOR: false,
    GUEST: false,
  },
  MANAGE_USERS: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: 'partial',
    COC_MEMBER: false,
    PRA: false,
    AUDITOR: false,
    LEGAL_ADVISOR: false,
    GUEST: false,
  },
  EXPORT_AUDIT_LOG: {
    SUPER_ADMIN: true,
    ORG_ADMIN: true,
    RP_LIQUIDATOR: true,
    COC_MEMBER: false,
    PRA: false,
    AUDITOR: false,
    LEGAL_ADVISOR: false,
    GUEST: false,
  },
};
