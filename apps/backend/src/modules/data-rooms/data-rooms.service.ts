import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { FoldersService } from '../folders/folders.service';
import { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import { generateOpaqueToken } from '../../common/utils/crypto.util';
import { normalizeEmail } from '../../common/utils/email.util';
import { getOrgStorageUsage } from '../../common/org-storage.util';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import {
  CONTENT_DELETE_ROLES,
  CONTENT_MANAGER_ROLES,
  DATA_ROOM_MANAGER_ROLES as ADMIN_ROLES,
  NO_DOWNLOAD_ROLES,
  ROLE_RANK,
} from '../../common/constants/content-roles';
import { CreateDataRoomDto } from './dto/create-data-room.dto';
import { UpdateDataRoomDto } from './dto/update-data-room.dto';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    private readonly foldersService: FoldersService,
    private readonly dataRoomAccess: DataRoomAccessService,
  ) {}

  async getMyAccess(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor, clientIp);

    return {
      effectiveRole,
      canManageRoom: ADMIN_ROLES.includes(effectiveRole),
      canUploadContent: CONTENT_MANAGER_ROLES.includes(effectiveRole),
      canDeleteContent: CONTENT_DELETE_ROLES.includes(effectiveRole),
      canDownload: !NO_DOWNLOAD_ROLES.includes(effectiveRole),
    };
  }

  async create(dto: CreateDataRoomDto, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.create({
      data: {
        organisationId: actor.organisationId,
        name: dto.name,
        type: dto.type,
        caseNumber: dto.caseNumber,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdBy: actor.id,
        members: {
          create: { userId: actor.id, joinedAt: new Date() },
        },
      },
    });

    if (dataRoom.type === 'CIRP') {
      await this.foldersService.seedCirpTemplate(dataRoom.id, actor.id);
    }

    await this.auditLogService.record({
      action: 'DATA_ROOM_CREATED',
      dataRoomId: dataRoom.id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: dataRoom.id,
    });

    return dataRoom;
  }

  async findAll(actor: AuthenticatedUser) {
    const where: Prisma.DataRoomWhereInput = {
      organisationId: actor.organisationId,
      deletedAt: null,
      ...(ADMIN_ROLES.includes(actor.role) ? {} : { members: { some: { userId: actor.id, removedAt: null } } }),
    };

    return this.prisma.dataRoom.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id, organisationId: actor.organisationId, deletedAt: null },
    });

    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }

    await this.assertMember(dataRoom.id, actor);

    return dataRoom;
  }

  async update(id: string, dto: UpdateDataRoomDto, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    const dataRoom = await this.prisma.dataRoom.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        caseNumber: dto.caseNumber,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.auditLogService.record({
      action: 'DATA_ROOM_UPDATED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
    });

    return dataRoom;
  }

  async updateSecuritySettings(id: string, dto: UpdateSecuritySettingsDto, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    const dataRoom = await this.prisma.dataRoom.update({
      where: { id },
      data: {
        ...(dto.ipAllowlistEnabled !== undefined && { ipAllowlistEnabled: dto.ipAllowlistEnabled }),
        ...(dto.allowedIps !== undefined && { allowedIps: dto.allowedIps }),
        ...(dto.ndaEnabled !== undefined && { ndaEnabled: dto.ndaEnabled }),
        ...(dto.ndaText !== undefined && { ndaText: dto.ndaText }),
      },
    });

    await this.auditLogService.record({
      action: 'DATA_ROOM_UPDATED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
      metadata: { securitySettings: true },
    });

    return dataRoom;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    await this.prisma.dataRoom.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditLogService.record({
      action: 'DATA_ROOM_DELETED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
    });
  }

  async setArchived(id: string, archived: boolean, actor: AuthenticatedUser) {
    await this.assertManager(id, actor);

    const dataRoom = await this.prisma.dataRoom.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });

    await this.auditLogService.record({
      action: 'DATA_ROOM_UPDATED',
      dataRoomId: id,
      userId: actor.id,
      resourceType: 'DataRoom',
      resourceId: id,
      metadata: { status: dataRoom.status },
    });

    return dataRoom;
  }

  async listMembers(dataRoomId: string, actor: AuthenticatedUser) {
    await this.findOne(dataRoomId, actor);

    return this.prisma.dataRoomMember.findMany({
      where: { dataRoomId, removedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            company: true,
            designation: true,
            mobile: true,
          },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });
  }

  async inviteMember(dataRoomId: string, dto: InviteMemberDto, actor: AuthenticatedUser) {
    const dataRoom = await this.assertManager(dataRoomId, actor);
    this.assertCanGrantRole(dto.role, actor);

    const email = normalizeEmail(dto.email);
    let user = await this.prisma.user.findUnique({ where: { email } });

    // No cross-org block: email is a global identity, and this is exactly
    // how a PRA/Auditor/etc. already active on one engagement gets added to
    // another -- they keep their one identity, gain a second
    // OrganisationMembership below.

    const inviterName = `${actor.firstName} ${actor.lastName}`;
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    let emailSent: boolean;

    // "Full Name" -> firstName/lastName the same way registration provisioning
    // splits it: everything but the last word is the first name.
    const nameParts = dto.fullName.trim().split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          organisationId: actor.organisationId,
          email,
          password: generateOpaqueToken().hash, // unusable placeholder until invite is accepted
          firstName,
          lastName,
          company: dto.company,
          designation: dto.designation,
          mobile: dto.mobile,
          role: dto.role,
          status: 'PENDING_INVITE',
        },
      });

      const { raw, hash } = generateOpaqueToken();
      const inviteHours = this.configService.get<number>('jwt.inviteExpiresHours')!;

      await this.prisma.inviteToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          invitedBy: actor.id,
          expiresAt: new Date(Date.now() + inviteHours * 60 * 60_000),
        },
      });

      const result = await this.mailService.sendUserInvitationEmail(
        user.email,
        `${frontendUrl}/accept-invite?token=${raw}`,
        dataRoom.name,
        inviterName,
        inviteHours,
        { userId: user.id, dataRoomId },
      );
      emailSent = result.sent;
    } else {
      // Existing, already-active user added to a different room -- their
      // established identity wins, so we only fill in profile gaps (never
      // overwrite something they, or an earlier invite, already set).
      if (dto.company || dto.designation || dto.mobile) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(user.company == null && dto.company ? { company: dto.company } : {}),
            ...(user.designation == null && dto.designation ? { designation: dto.designation } : {}),
            ...(user.mobile == null && dto.mobile ? { mobile: dto.mobile } : {}),
          },
        });
      }

      // Existing, already-active user added to a different room -- no
      // password setup needed, just let them know it's there.
      const result = await this.mailService.sendDataRoomInvitationEmail(
        user.email,
        user.firstName,
        `${frontendUrl}/login`,
        dataRoom.name,
        inviterName,
        { userId: user.id, dataRoomId },
      );
      emailSent = result.sent;
    }

    // Ensure org-level membership exists (no-op if they're already a member
    // of this org -- their existing role there is left untouched; a
    // different role for THIS room is what roleOverride below is for).
    await this.prisma.organisationMembership.upsert({
      where: { userId_organisationId: { userId: user.id, organisationId: actor.organisationId } },
      update: {},
      create: { userId: user.id, organisationId: actor.organisationId, role: dto.role, isOwner: false },
    });

    const member = await this.prisma.dataRoomMember.upsert({
      where: { dataRoomId_userId: { dataRoomId, userId: user.id } },
      update: { removedAt: null, roleOverride: dto.role, clientOrganisation: dto.clientOrganisation, notes: dto.notes },
      create: {
        dataRoomId,
        userId: user.id,
        invitedBy: actor.id,
        roleOverride: dto.role,
        clientOrganisation: dto.clientOrganisation,
        notes: dto.notes,
      },
    });

    await this.auditLogService.record({
      action: 'USER_INVITED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: user.id,
      metadata: {
        invitedEmail: user.email,
        role: dto.role,
        ...(dto.company ? { company: dto.company } : {}),
        ...(dto.designation ? { designation: dto.designation } : {}),
        ...(dto.clientOrganisation ? { clientOrganisation: dto.clientOrganisation } : {}),
      },
    });

    return { ...member, emailSent };
  }

  async resendInvite(dataRoomId: string, userId: string, actor: AuthenticatedUser) {
    const dataRoom = await this.assertManager(dataRoomId, actor);

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
      include: { user: true },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }
    if (member.user.status !== 'PENDING_INVITE') {
      throw new BadRequestException('This user has already accepted their invite');
    }

    const previousLog = await this.prisma.emailLog.findFirst({
      where: { userId, template: 'USER_INVITATION' },
      orderBy: { sentAt: 'desc' },
    });

    const { raw, hash } = generateOpaqueToken();
    const inviteHours = this.configService.get<number>('jwt.inviteExpiresHours')!;

    // userId is @unique on InviteToken -- delete+recreate rather than
    // update-in-place, so the new row is guaranteed fresh state (no risk of
    // a stale acceptedAt carrying over).
    await this.prisma.inviteToken.deleteMany({ where: { userId } });
    await this.prisma.inviteToken.create({
      data: {
        userId,
        tokenHash: hash,
        invitedBy: actor.id,
        expiresAt: new Date(Date.now() + inviteHours * 60 * 60_000),
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const result = await this.mailService.sendUserInvitationEmail(
      member.user.email,
      `${frontendUrl}/accept-invite?token=${raw}`,
      dataRoom.name,
      `${actor.firstName} ${actor.lastName}`,
      inviteHours,
      { userId, dataRoomId, resentFromId: previousLog?.id },
    );

    await this.auditLogService.record({
      action: 'USER_INVITED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: userId,
      metadata: { invitedEmail: member.user.email, resent: true },
    });

    return { emailSent: result.sent };
  }

  async updateMemberRole(dataRoomId: string, userId: string, role: UserRole, actor: AuthenticatedUser) {
    await this.assertManager(dataRoomId, actor);
    this.assertCanGrantRole(role, actor);

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    if (userId === actor.id && !ADMIN_ROLES.includes(role)) {
      throw new BadRequestException('You cannot demote yourself out of a manager role');
    }

    // Every @Roles() guard and the sidebar/dashboard/page-level UI gates all
    // read the user's GLOBAL User.role (JwtStrategy re-fetches it fresh on
    // every request). Writing only roleOverride here left that global role
    // stale forever, so "change role" only ever relabeled this one room's
    // member row -- the account kept behaving as its old role everywhere
    // else. Update both, in lockstep, so they can never diverge again.
    const [updated] = await this.prisma.$transaction([
      this.prisma.dataRoomMember.update({
        where: { dataRoomId_userId: { dataRoomId, userId } },
        data: { roleOverride: role },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role },
      }),
    ]);

    await this.auditLogService.record({
      action: 'USER_ROLE_CHANGED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: userId,
      metadata: { newRole: role },
    });

    return updated;
  }

  async removeMember(dataRoomId: string, userId: string, actor: AuthenticatedUser) {
    await this.assertManager(dataRoomId, actor);

    if (userId === actor.id) {
      throw new BadRequestException('You cannot remove yourself from a data room');
    }

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    await this.prisma.dataRoomMember.update({
      where: { dataRoomId_userId: { dataRoomId, userId } },
      data: { removedAt: new Date() },
    });

    await this.auditLogService.record({
      action: 'USER_REMOVED',
      dataRoomId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: userId,
    });
  }

  async resetMemberPassword(dataRoomId: string, userId: string, actor: AuthenticatedUser) {
    await this.assertManager(dataRoomId, actor);

    const member = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId } },
      include: { user: true },
    });

    if (!member || member.removedAt) {
      throw new NotFoundException('Member not found in this data room');
    }

    await this.authService.forgotPassword(member.user.email);
  }

  // Member-visible workspace stats for the room header cards and sidebar
  // folder counts. Document count + folder counts are fine for any member,
  // but member count and organisation storage are management figures -- they
  // are nulled for non-managers here so a direct API call can't read them
  // (the UI hides the corresponding cards, but the backend is the real gate).
  async getStats(dataRoomId: string, actor: AuthenticatedUser, clientIp?: string) {
    const { effectiveRole } = await this.dataRoomAccess.getAccess(dataRoomId, actor, clientIp);
    const isManager = ADMIN_ROLES.includes(effectiveRole);

    const [orgStorage, documents, members, lastActivity, folderGroups] = await Promise.all([
      // Storage shown in the room header/panel is ORGANISATION-wide -- the same
      // single source of truth the dashboard uses (Organisation.storageLimitGb +
      // total bytes across every room in the org). The per-room
      // DataRoom.storageLimitGb column is legacy and deliberately never surfaced.
      getOrgStorageUsage(this.prisma, actor.organisationId),
      this.prisma.file.count({ where: { dataRoomId, deletedAt: null } }),
      this.prisma.dataRoomMember.count({ where: { dataRoomId, removedAt: null } }),
      this.prisma.auditLog.findFirst({
        where: { dataRoomId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, action: true },
      }),
      this.prisma.file.groupBy({
        by: ['folderId'],
        where: { dataRoomId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const folderCounts: Record<string, number> = {};
    for (const group of folderGroups) {
      if (group.folderId) folderCounts[group.folderId] = group._count._all;
    }

    return {
      documents,
      members: isManager ? members : null,
      storageUsedBytes: isManager ? orgStorage.usedBytes.toString() : null,
      storageLimitGb: isManager ? orgStorage.limitGb : null,
      lastActivityAt: lastActivity?.createdAt ?? null,
      lastActivityAction: lastActivity?.action ?? null,
      folderCounts,
    };
  }

  private async assertMember(dataRoomId: string, actor: AuthenticatedUser): Promise<void> {
    if (ADMIN_ROLES.includes(actor.role)) {
      return;
    }

    const membership = await this.prisma.dataRoomMember.findUnique({
      where: { dataRoomId_userId: { dataRoomId, userId: actor.id } },
    });

    if (!membership || membership.removedAt) {
      throw new ForbiddenException('You do not have access to this data room');
    }
  }

  private async assertManager(dataRoomId: string, actor: AuthenticatedUser) {
    const dataRoom = await this.prisma.dataRoom.findFirst({
      where: { id: dataRoomId, organisationId: actor.organisationId, deletedAt: null },
    });

    if (!dataRoom) {
      throw new NotFoundException('Data room not found');
    }

    if (!ADMIN_ROLES.includes(actor.role)) {
      throw new ForbiddenException('You do not have permission to manage this data room');
    }

    return dataRoom;
  }

  // assertManager() only checks "is the actor a manager at all" (Super Admin /
  // Org Admin / RP-Liquidator, flat, no ordering). Without this, any of the
  // three -- including RP-Liquidator, the lowest of them -- could invite a
  // new member as, or promote an existing member to, ORG_ADMIN: the requested
  // role was validated against the same static ASSIGNABLE_MEMBER_ROLES list
  // regardless of who the actor was. This is the actual privilege boundary.
  private assertCanGrantRole(role: UserRole, actor: AuthenticatedUser) {
    if (ROLE_RANK[role] > ROLE_RANK[actor.role]) {
      throw new ForbiddenException('You cannot assign a role that outranks your own');
    }
  }
}
