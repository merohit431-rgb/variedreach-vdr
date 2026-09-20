import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ROLE_RANK } from '../../common/constants/content-roles';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { AssignableMembershipStatus } from './dto/update-member-status.dto';

@Injectable()
export class OrgMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listMembers(organisationId: string, actor: AuthenticatedUser) {
    await this.assertOrgAccess(organisationId, actor);

    const memberships = await this.prisma.organisationMembership.findMany({
      where: { organisationId },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      userId: m.userId,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      role: m.role,
      isOwner: m.isOwner,
      membershipStatus: m.status,
      accountStatus: m.user.status,
      lastLoginAt: m.user.lastLoginAt,
      memberSince: m.createdAt,
    }));
  }

  async updateMemberStatus(
    organisationId: string,
    targetUserId: string,
    status: AssignableMembershipStatus,
    actor: AuthenticatedUser,
  ) {
    await this.assertOrgAccess(organisationId, actor);

    // Self-suspend is always blocked, independent of rank -- an admin locking
    // out their own only account has no recovery path except another admin,
    // and for a single-Org-Admin org there may not be one.
    if (targetUserId === actor.id) {
      throw new ForbiddenException('You cannot change your own account status');
    }

    const membership = await this.prisma.organisationMembership.findUnique({
      where: { userId_organisationId: { userId: targetUserId, organisationId } },
    });
    if (!membership) {
      throw new NotFoundException('Member not found in this organisation');
    }

    // The org owner is the account the org was actually purchased/provisioned
    // under -- suspending it can strand the org with no admin able to
    // reinstate anyone. Super Admin can still override for abuse/fraud;
    // Org Admin cannot.
    if (membership.isOwner && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("You cannot change the organisation owner's account status");
    }

    if (ROLE_RANK[membership.role] > ROLE_RANK[actor.role]) {
      throw new ForbiddenException('You cannot change the status of a member who outranks you');
    }

    if (membership.status === status) {
      return membership;
    }

    const updated = await this.prisma.organisationMembership.update({
      where: { userId_organisationId: { userId: targetUserId, organisationId } },
      data: { status },
    });

    await this.auditLogService.record({
      action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      organisationId,
      userId: actor.id,
      resourceType: 'User',
      resourceId: targetUserId,
    });

    return updated;
  }

  // Super Admin can manage any organisation's members; everyone else only
  // their own, and only if they hold the org-wide (not per-room) manager
  // tier -- RP_LIQUIDATOR's "Manage Users" permission is scoped to data
  // rooms they're a member of, not the whole org (see content-roles.ts).
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
