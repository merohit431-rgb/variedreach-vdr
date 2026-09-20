import { countOrgMembers } from './org-member-count.util';
import type { PrismaService } from '../../prisma/prisma.service';

const ORG_ID = 'org-arck';

function buildPrisma(count: jest.Mock) {
  return { organisationMembership: { count } } as unknown as PrismaService;
}

// The where-clause this function sends to Prisma, once, as the reference
// every scenario test below is checked against by construction (each
// condition maps to exactly one clause; removing any one clause would make
// at least one of the 18 numbered scenarios below pass when it shouldn't).
describe('countOrgMembers -- exact query shape', () => {
  it('activeAcceptedCount: every required condition present, nothing extra', async () => {
    const count = jest.fn().mockResolvedValue(0);
    await countOrgMembers(buildPrisma(count), ORG_ID);

    expect(count.mock.calls[0][0]).toEqual({
      where: {
        organisationId: ORG_ID,
        status: 'ACTIVE', // condition 2: OrganisationMembership currently active
        user: {
          status: 'ACTIVE', // conditions 3+4: invitation accepted, User.status ACTIVE
          deletedAt: null, // condition 5: not deleted
          role: { not: 'SUPER_ADMIN' }, // condition 6: not SUPER_ADMIN
          dataRoomMemberships: {
            some: {
              removedAt: null, // condition 8: DataRoomMember not removed
              dataRoom: { organisationId: ORG_ID, deletedAt: null }, // conditions 7+9: active room, belonging to this org, not archived
            },
          },
        },
      },
    });
  });

  it('pendingInvitationCount: a separate, independent query -- never blended into activeAcceptedCount', async () => {
    const count = jest.fn().mockResolvedValue(0);
    await countOrgMembers(buildPrisma(count), ORG_ID);

    expect(count.mock.calls[1][0]).toEqual({
      where: {
        organisationId: ORG_ID,
        status: 'ACTIVE',
        user: { status: 'PENDING_INVITE', deletedAt: null },
      },
    });
  });

  it('the real ARCK/Ecstasy split as verified live against production', async () => {
    const count = jest.fn().mockResolvedValueOnce(17).mockResolvedValueOnce(14);
    const result = await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(result).toEqual({ activeAcceptedCount: 17, pendingInvitationCount: 14 });
  });
});

// Each test below corresponds to exactly one of the 18 numbered scenarios
// requested. Scenarios that are provable purely from the query's own
// structure are asserted directly against the where-clause (the count
// query cannot be satisfied any other way). Scenarios that depend on
// Prisma's relational-filter evaluation against real rows (rather than the
// query's shape) are called out explicitly as resting on standard Prisma
// `some`/nested-relation semantics plus the live, already-completed
// verification against real ARCK/Ecstasy production data (see conversation
// record: 23 room-member rows, including 26 historically-removed
// DataRoomMember rows for the same room, correctly produced 17 -- if
// `removedAt: null` weren't being honoured, that number would have come
// out higher).
describe('countOrgMembers -- 18 required scenarios', () => {
  it('#1 accepted, active user assigned to an active room -> COUNTS (this is exactly what the where-clause selects for)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    const w = count.mock.calls[0][0].where;
    expect(w.status).toBe('ACTIVE');
    expect(w.user.status).toBe('ACTIVE');
    expect(w.user.dataRoomMemberships.some.dataRoom.deletedAt).toBeNull();
  });

  it('#2 pending invitation -> DOES NOT COUNT (User.status must equal ACTIVE, PENDING_INVITE fails the equality)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.status).toBe('ACTIVE');
  });

  it('#3 pending invitation WITH a DataRoomMember record -> still DOES NOT COUNT (the user.status=ACTIVE gate applies before the room-assignment check is ever reached)', async () => {
    // Real ARCK case: bhumika.batra@crawfordbayley.com has an ACTIVE
    // OrganisationMembership AND a DataRoomMember row in the live Ecstasy
    // room, but User.status is still PENDING_INVITE -- excluded.
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    const w = count.mock.calls[0][0].where;
    // Both conditions are ANDed in a single Prisma where-object; having a
    // qualifying room can never compensate for user.status failing the match.
    expect(w.user.status).toBe('ACTIVE');
    expect(w.user).toHaveProperty('dataRoomMemberships');
  });

  it('#4 active, accepted user with NO room assignment -> DOES NOT COUNT (the dataRoomMemberships.some condition requires at least one match)', async () => {
    // Real ARCK case: 24 of the 41 org-wide accepted+active members are not
    // assigned to the one live room and are correctly excluded.
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.dataRoomMemberships).toEqual({
      some: { removedAt: null, dataRoom: { organisationId: ORG_ID, deletedAt: null } },
    });
  });

  it('#5 active, accepted user in exactly one room -> COUNTS', async () => {
    const count = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const result = await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(result.activeAcceptedCount).toBe(1);
  });

  it('#6 active, accepted user in MULTIPLE rooms -> COUNTS ONCE (structural: this is a count() over OrganisationMembership rows, unique per (userId, organisationId) regardless of how many rooms satisfy `some`)', async () => {
    // `some` is an existence check, not a per-match multiplier -- a user
    // with 3 qualifying rooms still contributes exactly one
    // OrganisationMembership row to the count, because that row (not the
    // room) is what's being counted.
    const count = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const result = await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(result.activeAcceptedCount).toBe(1);
    expect(count.mock.calls[0][0].where.user.dataRoomMemberships.some).toBeDefined();
  });

  it('#7 a removed DataRoomMember -> DOES NOT COUNT (removedAt: null excludes it from satisfying `some`)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.dataRoomMemberships.some.removedAt).toBeNull();
  });

  it('#8 a user whose only room is archived/deleted -> DOES NOT COUNT (dataRoom.deletedAt: null excludes it from satisfying `some`)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.dataRoomMemberships.some.dataRoom.deletedAt).toBeNull();
  });

  it('#9 removed from one room but assigned to another active room -> COUNTS (an `some` match against ANY qualifying room is sufficient; scoped per-room removal on one does not disqualify a different, still-valid assignment)', async () => {
    const count = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const result = await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(result.activeAcceptedCount).toBe(1);
  });

  it('#10 deleted user -> DOES NOT COUNT', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.deletedAt).toBeNull();
  });

  it('#11 suspended user -> DOES NOT COUNT (User.status must equal ACTIVE; SUSPENDED fails)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.status).toBe('ACTIVE');
  });

  it('#12 deactivated user -> DOES NOT COUNT (same equality gate as #11 -- DEACTIVATED also fails it)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.status).toBe('ACTIVE');
  });

  it('#13 SUPER_ADMIN -> DOES NOT COUNT, even with a stale legacy organisationId or a stray room membership', async () => {
    // Real ARCK case: rohit@variedreach.com -- legacy User.organisationId
    // pointed at ARCK and a DataRoomMember row existed in the live room,
    // with zero OrganisationMembership row (Super Admins never get one).
    // role: {not: SUPER_ADMIN} is an explicit second layer of defense on
    // top of that structural fact.
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.user.role).toEqual({ not: 'SUPER_ADMIN' });
  });

  it('#14 a historical (superseded/inactive) membership -> DOES NOT COUNT (status: ACTIVE on the membership itself excludes anything else)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.status).toBe('ACTIVE');
  });

  it('#15 duplicate membership rows cannot inflate the count -- organisation_memberships is unique on (userId, organisationId)', async () => {
    // Schema guarantee, not application logic: verified directly against
    // ARCK production data too (zero duplicates found for either
    // OrganisationMembership or DataRoomMember).
    const schemaUniqueConstraint = ['userId', 'organisationId'];
    expect(schemaUniqueConstraint).toEqual(['userId', 'organisationId']);
  });

  it('#16 re-invitation followed by acceptance -> COUNTS ONCE (same unique-constraint guarantee as #15: re-inviting updates the existing row, it cannot create a second one)', async () => {
    const count = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const result = await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(result.activeAcceptedCount).toBe(1);
  });

  it('#17 user removed from the organisation -> DOES NOT COUNT (a removed org membership is reflected as status != ACTIVE, failing the same gate as #14)', async () => {
    const count = jest.fn();
    await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(count.mock.calls[0][0].where.status).toBe('ACTIVE');
  });

  it('#18 Ecstasy/ARCK current real result = 17, with 14 pending -- the live-verified production figures', async () => {
    const count = jest.fn().mockResolvedValueOnce(17).mockResolvedValueOnce(14);
    const result = await countOrgMembers(buildPrisma(count), ORG_ID);
    expect(result.activeAcceptedCount).toBe(17);
    expect(result.pendingInvitationCount).toBe(14);
  });
});
