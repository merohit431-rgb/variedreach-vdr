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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
