import * as bcrypt from 'bcrypt';
import { Permission, PrismaClient } from '@prisma/client';
import { SYSTEM_ADMIN_ROLE, SYSTEM_USER_ROLE } from '../src/auth/constants';

const prisma = new PrismaClient();

// Chat app: all authenticated users need read + channel create + message delete (own).
const USER_DEFAULT_PERMISSIONS: Permission[] = [
  'CHAT_CHANNEL_READ',
  'CHAT_CHANNEL_CREATE',
  'CHAT_MESSAGE_DELETE',
];

const TEST_USERS = [
  { email: 'alice@example.com', name: 'Alice', password: 'password123' },
  { email: 'bob@example.com',   name: 'Bob',   password: 'password123' },
  { email: 'carol@example.com', name: 'Carol', password: 'password123' },
];

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

  const adminEmail = process.env.SEED_USER_EMAIL;
  const adminPassword = process.env.SEED_USER_PASSWORD;
  const adminName = process.env.SEED_USER_NAME;

  if (!adminEmail || !adminPassword) {
    console.log('SEED_USER_EMAIL / SEED_USER_PASSWORD not set — skipping user seed.');
    return;
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, password: await bcrypt.hash(adminPassword, 12), name: adminName },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`Seed user ready: ${adminEmail} (ADMIN)`);

  // ── Test users ─────────────────────────────────────────────────────────────
  const testUserIds: string[] = [];
  for (const u of TEST_USERS) {
    const hashed = await bcrypt.hash(u.password, 12);
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, password: hashed, name: u.name },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: userRole.id } },
      update: {},
      create: { userId: created.id, roleId: userRole.id },
    });
    testUserIds.push(created.id);
  }
  console.log(`Test users ready: ${TEST_USERS.map((u) => u.email).join(', ')}`);

  // ── Default channels ───────────────────────────────────────────────────────
  const defaultChannels = [
    { name: 'general', slug: 'general', description: 'Company-wide announcements and general discussion.' },
    { name: 'random',  slug: 'random',  description: 'Non-work banter and fun stuff.' },
  ];

  const allMemberIds = [adminUser.id, ...testUserIds];

  for (const ch of defaultChannels) {
    const channel = await prisma.channel.upsert({
      where: { slug: ch.slug },
      update: {},
      create: {
        name: ch.name,
        slug: ch.slug,
        description: ch.description,
        isPrivate: false,
        createdById: adminUser.id,
      },
    });

    for (const userId of allMemberIds) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: channel.id, userId } },
        update: {},
        create: {
          channelId: channel.id,
          userId,
          role: userId === adminUser.id ? 'OWNER' : 'MEMBER',
        },
      });
    }
    console.log(`#${ch.slug} ready (${allMemberIds.length} members)`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
