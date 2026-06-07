import * as bcrypt from 'bcrypt';
import { Permission, PrismaClient } from '@prisma/client';
import { SYSTEM_ADMIN_ROLE, SYSTEM_USER_ROLE } from '../src/auth/constants';

const prisma = new PrismaClient();

// USER role has no default permissions — add module-specific grants when forking.
const USER_DEFAULT_PERMISSIONS: Permission[] = [];

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: SYSTEM_ADMIN_ROLE },
    update: { displayName: 'Administrator', isSystem: true },
    create: { name: SYSTEM_ADMIN_ROLE, displayName: 'Administrator', isSystem: true, permissionPolicy: 'DENY_ALL' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: SYSTEM_USER_ROLE },
    update: { displayName: 'User', isSystem: true },
    create: { name: SYSTEM_USER_ROLE, displayName: 'User', isSystem: true, permissionPolicy: 'DENY_ALL' },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } }),
    prisma.rolePermission.createMany({
      data: USER_DEFAULT_PERMISSIONS.map((p) => ({ roleId: userRole.id, permission: p })),
    }),
  ]);
  console.log('System roles ready (ADMIN, USER)');

  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME;

  if (!email || !password) {
    console.log('SEED_USER_EMAIL / SEED_USER_PASSWORD not set — skipping user seed.');
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: hashed, name },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  console.log(`Seed user ready: ${email} (ADMIN)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
