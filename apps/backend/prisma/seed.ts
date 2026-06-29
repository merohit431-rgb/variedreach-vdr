import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function main() {
  const orgName = process.env.SEED_ORG_NAME || 'Demo Resolution Professionals LLP';
  const orgSlug = process.env.SEED_ORG_SLUG || 'demo-rp';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@insolvencyvdr.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const organisation = await prisma.organisation.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: orgName, slug: orgSlug },
  });

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      organisationId: organisation.id,
      email: adminEmail,
      password: passwordHash,
      firstName: 'Org',
      lastName: 'Admin',
      role: 'ORG_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`Organisation ready: ${organisation.name} (${organisation.slug})`);
  console.log(`Org Admin ready: ${admin.email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  (using default dev password "ChangeMe123!" — set SEED_ADMIN_PASSWORD to override)`);
  }

  if (process.env.SEED_RBAC_TEST_USERS === 'true') {
    await seedRbacTestData(organisation.id, admin.id);
  }
}

// Opt-in only (SEED_RBAC_TEST_USERS=true) — never runs against production,
// where that env var is never set. Creates the fixtures the V1.1 RBAC
// verification matrix (infrastructure/scripts/verify-rbac.sh) needs: a
// second data room with zero members (proves an external role can't see it
// or know it exists) and one user per non-admin role, all members of the
// FIRST room only, with a shared, clearly-fake, staging-only password.
const RBAC_TEST_PASSWORD = 'RbacTest123!';

async function seedRbacTestData(organisationId: string, adminId: string): Promise<void> {
  const roomA = await prisma.dataRoom.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000aa' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000aa',
      organisationId,
      name: 'RBAC Test Room A',
      type: 'CIRP',
      createdBy: adminId,
    },
  });

  await prisma.dataRoom.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000bb' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000bb',
      organisationId,
      name: 'RBAC Test Room B (no external members)',
      type: 'LIQUIDATION',
      createdBy: adminId,
    },
  });

  const passwordHash = await bcrypt.hash(RBAC_TEST_PASSWORD, BCRYPT_ROUNDS);
  const testRoles = ['RP_LIQUIDATOR', 'PRA', 'COC_MEMBER', 'AUDITOR', 'LEGAL_ADVISOR', 'GUEST'] as const;

  for (const role of testRoles) {
    const email = `rbac-${role.toLowerCase().replace('_', '-')}@staging.test`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        organisationId,
        email,
        password: passwordHash,
        firstName: 'RBAC Test',
        lastName: role,
        role,
        status: 'ACTIVE',
      },
    });

    await prisma.dataRoomMember.upsert({
      where: { dataRoomId_userId: { dataRoomId: roomA.id, userId: user.id } },
      update: {},
      create: {
        dataRoomId: roomA.id,
        userId: user.id,
        invitedBy: adminId,
        joinedAt: new Date(),
      },
    });
  }

  console.log(`RBAC test fixtures ready: 2 data rooms, ${testRoles.length} test users (password: ${RBAC_TEST_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
