/**
 * Idempotent seed: 3 ta rol, bitta SUPER_ADMIN va "Oliy ta'lim" darajasi.
 * Mavjud yozuvlarga tegmaydi — prod'da ham xavfsiz.
 */
import { ROLE_LABELS_UZ } from '@eco/shared';
import { PrismaClient, RoleSlug } from '@prisma/client';
import * as argon2 from 'argon2';

import { fixDarslar } from './data/darslar-tuzatish';
import { importEkologiyaFayllar, importVideoDarsliklar, importVideoDarsliklar2 } from './data/ekologiya-fayllar';
import { importOliyEkologiya, resetHomeMedia } from './data/oliy-ekologiya';
import { importPdvDarslar } from './data/pdv-darslar';
import { importPdvDiagnostika } from './data/pdv-diagnostika';

const prisma = new PrismaClient();

// Platforma faqat oliy ta'lim uchun — boshqa darajalar yaratilmaydi.
const LEVELS = [
  { slug: 'oliy-talim', nameUz: "Oliy ta'lim", descriptionUz: "Oliy o'quv yurtlari talabalari uchun", iconName: 'GraduationCap', orderIndex: 0, linkedEnum: 'OLIY_TALIM' },
] as const;

async function main() {
  for (const slug of Object.values(RoleSlug)) {
    await prisma.role.upsert({
      where: { slug },
      update: {},
      create: { slug, nameUz: ROLE_LABELS_UZ[slug] },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'SUPER_ADMIN' } });
  const hasAdmin = await prisma.userRole.count({ where: { roleId: adminRole.id } });
  if (!hasAdmin) {
    const email = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@eco-balance.uz').toLowerCase();
    await prisma.user.create({
      data: {
        email,
        firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'Bosh',
        lastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrator',
        passwordHash: await argon2.hash(process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe!2026', {
          type: argon2.argon2id,
        }),
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: adminRole.id } },
      },
    });
    console.log(`✓ super admin yaratildi: ${email}`);
  }

  for (const level of LEVELS) {
    await prisma.educationLevelItem.upsert({
      where: { slug: level.slug },
      update: {},
      create: { ...level, isBuiltIn: true },
    });
  }

  await runDataImportsOnce();
  console.log('✓ seed tayyor');
}

/**
 * Bir martalik kontent importlari. Bajarilgani platform_settings'dagi belgi bilan
 * qayd etiladi — keyin admin o'chirsa yoki o'zgartirsa, qayta yaratilmaydi.
 */
async function runDataImportsOnce() {
  const imports: Array<[key: string, run: () => Promise<boolean>]> = [
    ['data_import:pdv-diagnostika-v1', () => importPdvDiagnostika(prisma)],
    ['data_import:oliy-ekologiya-v1', () => importOliyEkologiya(prisma)],
    ['data_import:home-media-reset-v1', () => resetHomeMedia(prisma)],
    ['data_import:pdv-darslar-v1', () => importPdvDarslar(prisma)],
    ['data_import:ekologiya-fayllar-v1', () => importEkologiyaFayllar(prisma)],
    ['data_import:darslar-tuzatish-v1', () => fixDarslar(prisma)],
    ['data_import:video-5dars-v1', () => importVideoDarsliklar(prisma)],
    // v2: o'zbek odamlari suratlari bilan qayta tayyorlangan video
    ['data_import:video-5dars-v2', () => importVideoDarsliklar(prisma, { replace: true })],
    ['data_import:video-darsliklar-2-v1', () => importVideoDarsliklar2(prisma)],
    // ko'rsichqon, shovqin xaritasi va yangi suratlar bilan qayta tayyorlangan 7- va 8-dars
    ['data_import:video-7-8dars-v2', () => importVideoDarsliklar2(prisma, {
      replace: true,
      only: ['7-dars_Tuproq_muhitiga_moslashish.mp4', '8-dars_Shaharlarda_shovqin.mp4'],
    })],
    // 6-dars: yangi ovoz yozuvi bilan qayta tayyorlangan
    ['data_import:video-6dars-v2', () => importVideoDarsliklar2(prisma, {
      replace: true,
      only: ['6-dars_Suv_muhitiga_moslashish.mp4'],
    })],
    // 8-dars: chet ellik odamlar tushgan suratlar odamsiz suratlarga almashtirilgan
    ['data_import:video-8dars-v3', () => importVideoDarsliklar2(prisma, {
      replace: true,
      only: ['8-dars_Shaharlarda_shovqin.mp4'],
    })],
  ];
  for (const [key, run] of imports) {
    if (await prisma.platformSetting.findUnique({ where: { key } })) continue;
    // Bitta import yiqilsa (masalan, MinIO vaqtincha yo'q) qolganlari bajarilaveradi;
    // belgi qo'yilmaydi — keyingi ishga tushishda qayta urinadi.
    try {
      if (await run()) {
        await prisma.platformSetting.create({ data: { key, value: new Date().toISOString() } });
      }
    } catch (err) {
      console.error(`✗ ${key}:`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
