/**
 * Prisma seeder — idempotent.
 * Run: `pnpm --filter @eco/api prisma db seed`
 *
 * Phase LMS-3-rol (2026-10): faqat 3 ta rol — SUPER_ADMIN / TEACHER / STUDENT.
 */
import type { Role } from '@eco/shared';
import { ALL_PERMISSIONS, PERMISSION, ROLE_LABELS_UZ } from '@eco/shared';
import {
  EducationLevel,
  LessonType,
  PrismaClient,
  RoleSlug,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

// ---------------------------------------------------------------
// Rolga biriktirilgan permissionlar — 3 ta rol
// ---------------------------------------------------------------

const ROLE_PERMISSIONS: Record<RoleSlug, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  TEACHER: [
    PERMISSION.USERS_READ,
    PERMISSION.USERS_CREATE, // faqat STUDENT yaratish — servis layer tekshiradi
    PERMISSION.USERS_UPDATE,
    PERMISSION.NOTIFICATIONS_READ_OWN,
    PERMISSION.COURSES_READ,
    PERMISSION.COURSES_CREATE,
    PERMISSION.COURSES_UPDATE,
    PERMISSION.LESSONS_MANAGE,
    PERMISSION.MATERIALS_MANAGE,
    PERMISSION.QUIZZES_TAKE,
    PERMISSION.QUIZZES_MANAGE,
    PERMISSION.GROUPS_MANAGE,
    PERMISSION.ASSIGNMENTS_MANAGE,
    PERMISSION.STATS_READ_OWN,
  ],
  STUDENT: [
    PERMISSION.NOTIFICATIONS_READ_OWN,
    PERMISSION.COURSES_READ,
    PERMISSION.QUIZZES_TAKE,
    PERMISSION.ASSIGNMENTS_SUBMIT,
    PERMISSION.STATS_READ_OWN,
  ],
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
  [PERMISSION.COURSES_READ]: 'Kurslarni ko‘rish',
  [PERMISSION.COURSES_CREATE]: 'Kurs qo‘shish',
  [PERMISSION.COURSES_UPDATE]: 'Kursni tahrirlash',
  [PERMISSION.COURSES_DELETE]: 'Kursni o‘chirish',
  [PERMISSION.LESSONS_MANAGE]: 'Darslarni boshqarish',
  [PERMISSION.MATERIALS_MANAGE]: 'Darslik fayllarini yuklash va boshqarish',
  [PERMISSION.ECO_REPORTS_CREATE]: 'Ekologik murojaat yaratish (eski modul)',
  [PERMISSION.ECO_REPORTS_READ]: 'Ekologik murojaatlarni ko‘rish (eski modul)',
  [PERMISSION.ECO_REPORTS_MANAGE]: 'Murojaat holatini boshqarish (eski modul)',
  [PERMISSION.NEWS_READ]: 'Yangiliklarni ko‘rish (eski modul)',
  [PERMISSION.NEWS_MANAGE]: 'Yangiliklarni boshqarish (eski modul)',
  [PERMISSION.QUIZZES_TAKE]: 'Testlarni yechish',
  [PERMISSION.QUIZZES_MANAGE]: 'Testlarni yaratish/tahrirlash/natijalarni ko‘rish',
  [PERMISSION.GROUPS_MANAGE]: 'Guruhlarni yaratish va a‘zolarni boshqarish',
  [PERMISSION.ASSIGNMENTS_MANAGE]: 'Topshiriqlarni yaratish va baholash',
  [PERMISSION.ASSIGNMENTS_SUBMIT]: 'Topshiriq topshirish',
  [PERMISSION.STATS_READ_OWN]: 'O‘z statistikasini ko‘rish',
  [PERMISSION.STATS_READ_ALL]: 'Barcha statistikani ko‘rish',
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

async function seedSuperAdmin(roleIds: Map<RoleSlug, string>): Promise<string> {
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
    return existing.id;
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
  return userId;
}

// ---------------------------------------------------------------
// Super Admin singleton trigger (idempotent)
// ---------------------------------------------------------------

async function installSuperAdminTrigger(): Promise<void> {
  // Prisma's $executeRawUnsafe doesn't support multi-statement SQL. Run each
  // statement separately. Function body uses $$-quoting internally.
  const createFn = `
CREATE OR REPLACE FUNCTION enforce_super_admin_singleton()
RETURNS TRIGGER AS $f$
DECLARE
  super_role_id UUID;
  other_count INT;
BEGIN
  SELECT id INTO super_role_id FROM roles WHERE slug = 'SUPER_ADMIN';
  IF NEW.role_id = super_role_id THEN
    SELECT COUNT(*) INTO other_count FROM user_roles
      WHERE role_id = super_role_id AND user_id != NEW.user_id;
    IF other_count > 0 THEN
      RAISE EXCEPTION 'Only one SUPER_ADMIN is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql
`;
  const dropTrigger = `DROP TRIGGER IF EXISTS user_roles_super_admin_singleton_trigger ON user_roles`;
  const createTrigger = `
CREATE TRIGGER user_roles_super_admin_singleton_trigger
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION enforce_super_admin_singleton()
`;
  await prisma.$executeRawUnsafe(createFn);
  await prisma.$executeRawUnsafe(dropTrigger);
  await prisma.$executeRawUnsafe(createTrigger);
  console.log('  ✓ super admin singleton trigger installed');
}

// ---------------------------------------------------------------
// Education levels (built-in)
// ---------------------------------------------------------------

async function seedEducationLevels(): Promise<Map<string, string>> {
  const levels = [
    {
      slug: 'maktabgacha',
      nameUz: "Maktabgacha ta'lim",
      descriptionUz: "Bog'cha yoshidagi bolalar uchun ekologik bilimlar",
      iconName: 'Baby',
      orderIndex: 0,
      linkedEnum: EducationLevel.MAKTABGACHA,
    },
    {
      slug: 'maktab',
      nameUz: "Maktab ta'limi",
      descriptionUz: "Umumiy o'rta ta'lim maktab o'quvchilari uchun",
      iconName: 'School',
      orderIndex: 1,
      linkedEnum: EducationLevel.MAKTAB,
    },
    {
      slug: 'oliy-talim',
      nameUz: "Oliy ta'lim",
      descriptionUz: "Oliy o'quv yurtlari talabalari uchun",
      iconName: 'GraduationCap',
      orderIndex: 2,
      linkedEnum: EducationLevel.OLIY_TALIM,
    },
  ];

  const map = new Map<string, string>();
  for (const lvl of levels) {
    const existing = await prisma.educationLevelItem.findUnique({ where: { slug: lvl.slug } });
    if (existing) {
      map.set(lvl.slug, existing.id);
      continue;
    }
    const created = await prisma.educationLevelItem.create({
      data: { id: uuidv7(), ...lvl, isBuiltIn: true },
    });
    map.set(lvl.slug, created.id);
  }
  return map;
}

// ---------------------------------------------------------------
// PDV kursi (lecture nomlari) — mavjud bo'lsa o'tkazamiz
// ---------------------------------------------------------------

const PDV_LECTURES: { order: number; title: string }[] = [
  { order: 1,  title: "Pedagogik dasturiy vositalar: kirish va tasnif" },
  { order: 2,  title: "Virtual laboratoriya, 3D, AR va VR texnologiyalari" },
  { order: 3,  title: "Pedagogik dasturiy vositalarni yaratish vositalari" },
  { order: 4,  title: "PDV loyihalashtirish va pedagogik talablar" },
  { order: 5,  title: "Video muharrirlar — Camtasia va Bandicam" },
  { order: 6,  title: "Elektron nazorat va diagnostika tizimlari" },
  { order: 7,  title: "Krossvord va interaktiv topshiriqlar yaratish" },
  { order: 8,  title: "iSpring — interaktiv resurslar va testlar" },
  { order: 9,  title: "Elektron darsliklarni yaratish texnologiyasi" },
  { order: 10, title: "CMS tizimlari va ta'lim portallari" },
  { order: 11, title: "Ta'limiy saytlarni loyihalash va joylashtirish" },
  { order: 12, title: "LMS — Moodle va LearnDash elektron kurs platforma" },
  { order: 13, title: "Moodle'da testlar yaratish va baholash" },
  { order: 14, title: "LMS interaktivlik va foydalanuvchi tajribasi" },
  { order: 15, title: "MOOC — ommaviy ochiq onlayn kurslar" },
];

const PDV_PRACTICALS: { order: number; title: string }[] = [
  { order: 16, title: "1-amaliy: PDV tahlili va taqqoslash" },
  { order: 17, title: "2-amaliy: Virtual laboratoriya modeli yaratish" },
  { order: 18, title: "3-amaliy: Video dars tayyorlash (Camtasia)" },
  { order: 19, title: "4-amaliy: iSpring bilan interaktiv modul" },
  { order: 20, title: "5-amaliy: Moodle kurs sozlash va test" },
  { order: 21, title: "6-amaliy: Elektron darslik loyihasi" },
  { order: 22, title: "7-amaliy: Pedagogik dasturiy vosita yakuniy loyihasi" },
];

async function seedPDVCourse(superAdminId: string): Promise<void> {
  const SLUG = 'pedagogik-dasturiy-vositalar';

  const existing = await prisma.course.findUnique({ where: { slug: SLUG } });
  if (existing) {
    if (!existing.ownerId) {
      await prisma.course.update({ where: { id: existing.id }, data: { ownerId: superAdminId } });
    }
    console.log(`  ✓ PDV kursi mavjud: ${SLUG}`);
    return;
  }

  const course = await prisma.course.create({
    data: {
      id: uuidv7(),
      slug: SLUG,
      nameUz: "Pedagogik dasturiy vositalar",
      descriptionUz:
        "ChDPU talabalari uchun pedagogik dasturiy vositalar, e-learning texnologiyalari va " +
        "LMS platformalarini o'rgatuvchi kurs. 15 ma'ruza + 7 amaliy mashg'ulot.",
      educationLevel: 'oliy-talim',
      isPublished: true,
      ownerId: superAdminId,
    },
  });

  const lessonData = [
    ...PDV_LECTURES.map((l) => ({
      id: uuidv7(),
      courseId: course.id,
      orderIndex: l.order,
      lessonType: LessonType.MARUZA,
      titleUz: l.title,
    })),
    ...PDV_PRACTICALS.map((p) => ({
      id: uuidv7(),
      courseId: course.id,
      orderIndex: p.order,
      lessonType: LessonType.AMALIY,
      titleUz: p.title,
    })),
  ];

  await prisma.lesson.createMany({ data: lessonData });
  console.log(
    `  ✓ PDV kursi yaratildi (${lessonData.length} dars, owner=SUPER_ADMIN)`,
  );
}

// ---------------------------------------------------------------
// Namuna (idempotent): 1 ta TEACHER + 1 ta Group + 2 ta STUDENT
// Faqat NODE_ENV=development yoki SEED_DEMO=true bo'lsa.
// ---------------------------------------------------------------

const DEMO_TEACHER_EMAIL = 'teacher@test.uz';
const DEMO_STUDENT1_EMAIL = 'student1@test.uz';
const DEMO_STUDENT2_EMAIL = 'student2@test.uz';
const DEMO_PASSWORD = 'StudentPass!2026';
const DEMO_GROUP_NAME = 'Test guruh';

async function seedDemoUsers(roleIds: Map<RoleSlug, string>, superAdminId: string): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
    console.log('  (demo foydalanuvchilar o‘tkazib yuborildi — prod rejim)');
    return;
  }

  const teacherRoleId = roleIds.get(RoleSlug.TEACHER)!;
  const studentRoleId = roleIds.get(RoleSlug.STUDENT)!;

  const passHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  async function upsertUser(email: string, firstName: string, lastName: string, roleId: string, createdById: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        id: uuidv7(),
        firstName,
        lastName,
        email,
        passwordHash: passHash,
        emailVerifiedAt: new Date(),
        createdById,
        roles: { create: { roleId } },
      },
    });
  }

  const teacher = await upsertUser(DEMO_TEACHER_EMAIL, "O'qituvchi", 'Karimov', teacherRoleId, superAdminId);
  const student1 = await upsertUser(DEMO_STUDENT1_EMAIL, 'Ali', 'Valiev', studentRoleId, teacher.id);
  const student2 = await upsertUser(DEMO_STUDENT2_EMAIL, 'Nilufar', 'Nazarova', studentRoleId, teacher.id);

  // Guruh
  let group = await prisma.group.findFirst({
    where: { teacherId: teacher.id, nameUz: DEMO_GROUP_NAME },
  });
  if (!group) {
    group = await prisma.group.create({
      data: {
        id: uuidv7(),
        teacherId: teacher.id,
        nameUz: DEMO_GROUP_NAME,
        descriptionUz: 'Demo guruh — Ta‘lim yo‘nalishi talabalari uchun test maydoni.',
      },
    });
  }

  // Guruh a'zoligi — har studentId unique
  for (const s of [student1, student2]) {
    const existingMembership = await prisma.groupMember.findUnique({ where: { studentId: s.id } });
    if (!existingMembership) {
      await prisma.groupMember.create({ data: { groupId: group.id, studentId: s.id } });
    }
  }

  console.log(`  ✓ demo: TEACHER (${teacher.email}), 2 STUDENT, 1 Group — parol: ${DEMO_PASSWORD}`);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding PedResearch Lab (3-rol LMS) base data…');
  const permissionIds = await seedPermissions();
  console.log(`  ✓ ${permissionIds.size} permissions`);
  const roleIds = await seedRoles(permissionIds);
  console.log(`  ✓ ${roleIds.size} roles (SUPER_ADMIN / TEACHER / STUDENT)`);
  const superAdminId = await seedSuperAdmin(roleIds);
  await installSuperAdminTrigger();
  await seedEducationLevels();
  console.log('  ✓ ta\'lim darajalari');
  await seedPDVCourse(superAdminId);
  await seedDemoUsers(roleIds, superAdminId);
  console.log('🌱 Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
