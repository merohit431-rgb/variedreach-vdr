import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

// Organisation-scoped groups, grantable on folders exactly like an
// individual user (see FolderAccessService). Management is org-admin tier
// only -- the same assertOrgAccess() shape OrgMembersService already uses
// for exactly this cross-tenant boundary (Super Admin: any org; Org Admin:
// only their own), duplicated here rather than extracted into a shared
// helper, since that extraction would touch an existing, working file for
// no functional gain.
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(organisationId: string, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);

    const groups = await this.prisma.group.findMany({
      where: { organisationId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { members: { where: { removedAt: null } } } } },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      isActive: g.isActive,
      memberCount: g._count.members,
      createdAt: g.createdAt,
    }));
  }

  async getGroup(organisationId: string, groupId: string, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);
    const group = await this.getGroupOrThrow(organisationId, groupId);

    const members = await this.prisma.groupMember.findMany({
      where: { groupId, removedAt: null },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { addedAt: 'asc' },
    });

    const folderGrants = await this.prisma.folderAccessGrant.findMany({
      where: { groupId, revokedAt: null },
      include: { folder: { select: { id: true, name: true, dataRoomId: true } } },
    });

    return {
      id: group.id,
      name: group.name,
      isActive: group.isActive,
      members: members.map((m) => ({
        userId: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.user.role,
        addedAt: m.addedAt,
      })),
      folderGrants: folderGrants.map((g) => ({
        folderId: g.folder.id,
        folderName: g.folder.name,
        dataRoomId: g.folder.dataRoomId,
        grantedAt: g.grantedAt,
      })),
    };
  }

  async create(organisationId: string, dto: CreateGroupDto, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);

    const group = await this.prisma.group.create({
      data: { organisationId, name: dto.name, createdBy: actor.id },
    });

    await this.auditLogService.record({
      action: 'GROUP_CREATED',
      organisationId,
      userId: actor.id,
      resourceType: 'Group',
      resourceId: group.id,
      metadata: { name: group.name },
    });

    return group;
  }

  async update(organisationId: string, groupId: string, dto: UpdateGroupDto, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);
    const group = await this.getGroupOrThrow(organisationId, groupId);

    if (dto.name === undefined && dto.isActive === undefined) {
      return group;
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        name: dto.name ?? group.name,
        isActive: dto.isActive ?? group.isActive,
      },
    });

    const changes: Record<string, { from: string | boolean; to: string | boolean }> = {};
    if (dto.name !== undefined && dto.name !== group.name) changes.name = { from: group.name, to: dto.name };
    if (dto.isActive !== undefined && dto.isActive !== group.isActive) {
      changes.isActive = { from: group.isActive, to: dto.isActive };
    }

    await this.auditLogService.record({
      action: 'GROUP_UPDATED',
      organisationId,
      userId: actor.id,
      resourceType: 'Group',
      resourceId: groupId,
      metadata: changes,
    });

    return updated;
  }

  async addMember(organisationId: string, groupId: string, userId: string, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);
    await this.getGroupOrThrow(organisationId, groupId);

    // The target user must themselves belong to THIS organisation -- the
    // direct cross-tenant-pollution guard: without this, an Org Admin could
    // add an arbitrary userId from a different organisation into one of
    // their own groups, and that user would then inherit any folder grant
    // the group holds in THIS org's data rooms.
    const membership = await this.prisma.organisationMembership.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
    });
    if (!membership) {
      throw new NotFoundException('User is not a member of this organisation');
    }

    const existing = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (existing && !existing.removedAt) {
      return existing; // already a member -- idempotent
    }

    const member = await this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: { removedAt: null, addedBy: actor.id, addedAt: new Date() },
      create: { groupId, userId, addedBy: actor.id },
    });

    await this.auditLogService.record({
      action: 'GROUP_MEMBER_ADDED',
      organisationId,
      userId: actor.id,
      resourceType: 'Group',
      resourceId: groupId,
      metadata: { targetUserId: userId },
    });

    return member;
  }

  async removeMember(organisationId: string, groupId: string, userId: string, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);
    await this.getGroupOrThrow(organisationId, groupId);

    const existing = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!existing || existing.removedAt) {
      throw new NotFoundException('User is not a member of this group');
    }

    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { removedAt: new Date() },
    });

    await this.auditLogService.record({
      action: 'GROUP_MEMBER_REMOVED',
      organisationId,
      userId: actor.id,
      resourceType: 'Group',
      resourceId: groupId,
      metadata: { targetUserId: userId },
    });
  }

  private async getGroupOrThrow(organisationId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({ where: { id: groupId, organisationId } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  // Mirrors OrgMembersService.assertOrgAccess() exactly: Super Admin can
  // manage any organisation's groups; everyone else only their own, and
  // only at the org-wide admin tier.
  private async assertOrgAccess(organisationId: string, actor: AuthenticatedUser): Promise<void> {
    if (actor.role === UserRole.SUPER_ADMIN) {
      const org = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
      if (!org) throw new NotFoundException('Organisation not found');
      return;
    }

    if (actor.role !== UserRole.ORG_ADMIN || actor.organisationId !== organisationId) {
      throw new ForbiddenException('You do not have permission to manage this organisation');
    }
  }
}
