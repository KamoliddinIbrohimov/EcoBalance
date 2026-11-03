// Bir martalik baseline. Prod baza ilgari `prisma db push` bilan boshqarilgan:
// jadvallar bor, lekin `0_init` migratsiyasi qayd etilmagan. Shunday bazada
// `0_init`ni "qo'llangan" deb belgilaymiz — ma'lumotga hech qanday o'zgartirish
// kiritilmaydi. Bo'sh bazada hech narsa qilmaydi (migrate deploy 0_init'ni qo'llaydi).
import { execSync } from 'node:child_process';

import prismaPkg from '@prisma/client';

const prisma = new prismaPkg.PrismaClient();
try {
  const [state] = await prisma.$queryRaw`
    SELECT to_regclass('public.users') IS NOT NULL AS "hasTables",
           to_regclass('public._prisma_migrations') IS NOT NULL AS "hasHistory"`;
  let baselined = false;
  if (state.hasHistory) {
    const rows = await prisma.$queryRaw`
      SELECT 1 FROM _prisma_migrations WHERE migration_name = '0_init' AND finished_at IS NOT NULL`;
    baselined = rows.length > 0;
  }
  if (state.hasTables && !baselined) {
    console.log('▸ mavjud baza: 0_init qo‘llangan deb belgilanmoqda (ma’lumot o‘zgarmaydi)');
    execSync('npx prisma migrate resolve --applied 0_init', { stdio: 'inherit' });
  }
} finally {
  await prisma.$disconnect();
}
