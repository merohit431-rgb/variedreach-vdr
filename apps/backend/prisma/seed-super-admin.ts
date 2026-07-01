import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@variedreach.com';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@2026!';

  const org = await prisma.organisation.upsert({
    where: { slug: 'variedreach-platform' },
    update: {},
    create: { name: 'VariedReach Platform', slug: 'variedreach-platform' },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      organisationId: org.id,
      email,
      password: passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`Platform org: ${org.name} (${org.id})`);
  console.log(`Super Admin: ${user.email} (${user.id})`);
  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.log(`Default password: ${password}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
