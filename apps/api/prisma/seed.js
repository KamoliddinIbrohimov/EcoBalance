"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("@eco/shared");
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
const ROLE_PERMISSIONS = {
    SUPER_ADMIN: shared_1.ALL_PERMISSIONS,
    ADMIN: [
        shared_1.PERMISSION.USERS_READ,
        shared_1.PERMISSION.USERS_CREATE,
        shared_1.PERMISSION.USERS_UPDATE,
        shared_1.PERMISSION.ORGS_READ,
        shared_1.PERMISSION.ORGS_CREATE,
        shared_1.PERMISSION.ORGS_UPDATE,
        shared_1.PERMISSION.ROLES_READ,
        shared_1.PERMISSION.AUDIT_READ,
        shared_1.PERMISSION.NOTIFICATIONS_MANAGE,
        shared_1.PERMISSION.NOTIFICATIONS_READ_OWN,
    ],
    CITY_ADMIN: [
        shared_1.PERMISSION.USERS_READ,
        shared_1.PERMISSION.ORGS_READ,
        shared_1.PERMISSION.ORGS_UPDATE,
        shared_1.PERMISSION.NOTIFICATIONS_READ_OWN,
    ],
    MAHALLA_MANAGER: [
        shared_1.PERMISSION.USERS_READ,
        shared_1.PERMISSION.ORGS_READ,
        shared_1.PERMISSION.NOTIFICATIONS_READ_OWN,
    ],
    TEACHER: [shared_1.PERMISSION.USERS_READ, shared_1.PERMISSION.NOTIFICATIONS_READ_OWN],
    STUDENT: [shared_1.PERMISSION.NOTIFICATIONS_READ_OWN],
    CITIZEN: [shared_1.PERMISSION.NOTIFICATIONS_READ_OWN],
};
const PERMISSION_LABELS = {
    [shared_1.PERMISSION.USERS_READ]: 'Foydalanuvchilarni ko‘rish',
    [shared_1.PERMISSION.USERS_CREATE]: 'Foydalanuvchi qo‘shish',
    [shared_1.PERMISSION.USERS_UPDATE]: 'Foydalanuvchini tahrirlash',
    [shared_1.PERMISSION.USERS_DELETE]: 'Foydalanuvchini o‘chirish',
    [shared_1.PERMISSION.ORGS_READ]: 'Tashkilotlarni ko‘rish',
    [shared_1.PERMISSION.ORGS_CREATE]: 'Tashkilot qo‘shish',
    [shared_1.PERMISSION.ORGS_UPDATE]: 'Tashkilotni tahrirlash',
    [shared_1.PERMISSION.ORGS_DELETE]: 'Tashkilotni o‘chirish',
    [shared_1.PERMISSION.ROLES_READ]: 'Rollarni ko‘rish',
    [shared_1.PERMISSION.ROLES_MANAGE]: 'Rollarni boshqarish',
    [shared_1.PERMISSION.AUDIT_READ]: 'Audit jurnalini ko‘rish',
    [shared_1.PERMISSION.NOTIFICATIONS_READ_OWN]: 'O‘z bildirishnomalarini ko‘rish',
    [shared_1.PERMISSION.NOTIFICATIONS_MANAGE]: 'Bildirishnomalarni boshqarish',
};
async function seedPermissions() {
    const map = new Map();
    for (const slug of shared_1.ALL_PERMISSIONS) {
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
            data: { id: (0, uuid_1.v7)(), slug, module: module ?? '', action: action ?? '', nameUz },
        });
        map.set(slug, created.id);
    }
    return map;
}
async function seedRoles(permissionIds) {
    const roleMap = new Map();
    for (const slug of Object.values(client_1.RoleSlug)) {
        const nameUz = shared_1.ROLE_LABELS_UZ[slug];
        const role = await prisma.role.upsert({
            where: { slug },
            update: { nameUz },
            create: { id: (0, uuid_1.v7)(), slug, nameUz },
        });
        roleMap.set(slug, role.id);
        const wantedSlugs = ROLE_PERMISSIONS[slug];
        const wantedIds = new Set(wantedSlugs.map((s) => permissionIds.get(s)).filter(Boolean));
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
async function seedSuperAdmin(roleIds) {
    const email = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@eco-balance.uz').toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe!2026';
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Bosh';
    const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrator';
    const superAdminRoleId = roleIds.get(client_1.RoleSlug.SUPER_ADMIN);
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
    const userId = (0, uuid_1.v7)();
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
async function main() {
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
//# sourceMappingURL=seed.js.map