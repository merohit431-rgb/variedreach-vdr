import { PrismaService } from '../../prisma/prisma.service';

export interface OrgMemberCounts {
  // Counts toward the subscription/seat limit. A user must be: an ACTIVE
  // OrganisationMembership (the real, authoritative table -- not the legacy
  // User.organisationId snapshot), an ACTIVE User account (i.e. they've
  // actually accepted their invite and set a password -- PENDING_INVITE
  // never counts, no matter how long ago it was sent), not soft-deleted,
  // not a Super Admin (platform-wide, not a real member of any one org),
  // AND assigned to at least one of this org's current (non-archived) data
  // rooms. That last condition is deliberate, confirmed with the customer:
  // an org membership can exist without a room assignment (someone invited
  // to the org but not yet placed on a specific engagement), and those
  // people don't consume a seat until they're actually working in a room.
  activeAcceptedCount: number;
  // A real ACTIVE membership exists, but the person has never accepted --
  // shown separately, never folded into activeAcceptedCount.
  pendingInvitationCount: number;
}

export async function countOrgMembers(prisma: PrismaService, organisationId: string): Promise<OrgMemberCounts> {
  const [activeAcceptedCount, pendingInvitationCount] = await Promise.all([
    prisma.organisationMembership.count({
      where: {
        organisationId,
        status: 'ACTIVE',
        user: {
          status: 'ACTIVE',
          deletedAt: null,
          role: { not: 'SUPER_ADMIN' },
          dataRoomMemberships: {
            some: {
              removedAt: null,
              dataRoom: { organisationId, deletedAt: null },
            },
          },
        },
      },
    }),
    prisma.organisationMembership.count({
      where: {
        organisationId,
        status: 'ACTIVE',
        user: { status: 'PENDING_INVITE', deletedAt: null },
      },
    }),
  ]);

  return { activeAcceptedCount, pendingInvitationCount };
}
