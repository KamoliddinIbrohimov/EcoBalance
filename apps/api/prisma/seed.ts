/**
 * Prisma seeder — idempotent.
 * Run: `pnpm --filter @eco/api prisma db seed`
 */
import type { Role } from '@eco/shared';
import { ALL_PERMISSIONS, PERMISSION, ROLE_LABELS_UZ } from '@eco/shared';
import { PrismaClient, RoleSlug } from '@prisma/client';
import * as argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<RoleSlug, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: [
    PERMISSION.USERS_READ,
    PERMISSION.USERS_CREATE,
    PERMISSION.USERS_UPDATE,
    PERMISSION.ORGS_READ,
    PERMISSION.ORGS_CREATE,
    PERMISSION.ORGS_UPDATE,
    PERMISSION.ROLES_READ,
    PERMISSION.AUDIT_READ,
    PERMISSION.NOTIFICATIONS_MANAGE,
    PERMISSION.NOTIFICATIONS_READ_OWN,
  ],
  CITY_ADMIN: [
    PERMISSION.USERS_READ,
    PERMISSION.ORGS_READ,
    PERMISSION.ORGS_UPDATE,
    PERMISSION.NOTIFICATIONS_READ_OWN,
  ],
  MAHALLA_MANAGER: [
    PERMISSION.USERS_READ,
    PERMISSION.ORGS_READ,
    PERMISSION.NOTIFICATIONS_READ_OWN,
  ],
  TEACHER: [PERMISSION.USERS_READ, PERMISSION.NOTIFICATIONS_READ_OWN],
  STUDENT: [PERMISSION.NOTIFICATIONS_READ_OWN],
  CITIZEN: [PERMISSION.NOTIFICATIONS_READ_OWN],
};

const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSION.USERS_READ]: 'Foydalanuvchilarni ko‘rish',
  [PERMISSION.USERS_CREATE]: 'Foydalanuvchi qo‘shish',
  [PERMISSION.USERS_UPDATE]: 'Foydalanuvchini tahrirlash',
  [PERMISSION.USERS_DELETE]: 'Foydalanuvchini o‘chirish',
  [PERMISSION.ORGS_READ]: 'Tashkilotlarni ko‘rish',
  [PERMISSION.ORGS_CREATE]: 'Tashkilot qo‘shish',
  [PERMISSION.ORGS_UPDATE]: 'Tashkilotni tahrirlash',
  [PERMISSION.ORGS_DELETE]: 'Tashkilotni o‘chirish',
  [PERMISSION.ROLES_READ]: 'Rollarni ko‘rish',
  [PERMISSION.ROLES_MANAGE]: 'Rollarni boshqarish',
  [PERMISSION.AUDIT_READ]: 'Audit jurnalini ko‘rish',
  [PERMISSION.NOTIFICATIONS_READ_OWN]: 'O‘z bildirishnomalarini ko‘rish',
  [PERMISSION.NOTIFICATIONS_MANAGE]: 'Bildirishnomalarni boshqarish',
};

async function seedPermissions(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const slug of ALL_PERMISSIONS) {
    const [module, action] = slug.split('.', 2);
    const existing = await prisma.permission.findUnique({ where: { slug } });
    const nameUz = PERMISSION_LABELS[slug] ?? slug;

    if (existing) {
      map.set(slug, existing.id);
      if (existing.nameUz !== nameUz) {
        await prisma.permission.update({ where: { id: existing.id }, data: { nameUz } });
      }
      continue;
    }

    const created = await prisma.permission.create({
      data: { id: uuidv7(), slug, module: module ?? '', action: action ?? '', nameUz },
    });
    map.set(slug, created.id);
  }

  return map;
}

async function seedRoles(permissionIds: Map<string, string>): Promise<Map<RoleSlug, string>> {
  const roleMap = new Map<RoleSlug, string>();

  for (const slug of Object.values(RoleSlug)) {
    const nameUz = ROLE_LABELS_UZ[slug as Role];
    const role = await prisma.role.upsert({
      where: { slug },
      update: { nameUz },
      create: { id: uuidv7(), slug, nameUz },
    });
    roleMap.set(slug, role.id);

    const wantedSlugs = ROLE_PERMISSIONS[slug];
    const wantedIds = new Set(wantedSlugs.map((s) => permissionIds.get(s)!).filter(Boolean));
    const current = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    const currentIds = new Set(current.map((r) => r.permissionId));

    const toAdd = [...wantedIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !wantedIds.has(id));

    if (toAdd.length) {
      await prisma.rolePermission.createMany({
        data: toAdd.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
    if (toRemove.length) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: toRemove } },
      });
    }
  }

  return roleMap;
}

async function seedSuperAdmin(roleIds: Map<RoleSlug, string>): Promise<void> {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@eco-balance.uz').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Bosh';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrator';

  const superAdminRoleId = roleIds.get(RoleSlug.SUPER_ADMIN)!;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ super admin already exists: ${email}`);
    const hasRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: existing.id, roleId: superAdminRoleId } },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: existing.id, roleId: superAdminRoleId },
      });
      console.log(`  → attached SUPER_ADMIN role`);
    }
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const userId = uuidv7();
  await prisma.user.create({
    data: {
      id: userId,
      firstName,
      lastName,
      email,
      passwordHash,
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: superAdminRoleId } },
    },
  });
  console.log(`✓ super admin created: ${email}`);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding Eco-Balance base data…');
  const permissionIds = await seedPermissions();
  console.log(`  ✓ ${permissionIds.size} permissions`);
  const roleIds = await seedRoles(permissionIds);
  console.log(`  ✓ ${roleIds.size} roles`);
  await seedSuperAdmin(roleIds);
  console.log('🌱 Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
