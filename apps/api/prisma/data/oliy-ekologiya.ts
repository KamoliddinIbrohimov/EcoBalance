/**
 * Oliy ta'lim ekologiya darslari kontenti (manba: docs/materials/ekologiya/*.docx,
 * 15 ta mashg'ulot): 1–9 → "Ekologiya asoslari", 10–15 → "O'zbekiston tabiati va
 * siyosati". JSON docx'dan generatsiya qilingan (maqsad, jihozlar, nazariya,
 * bajarish tartibi, nazorat savollari, xulosa; "Javob:" bloklari chiqarilgan).
 */
import type { PrismaClient } from '@prisma/client';

import { fillLessonContent } from './lesson-content';
import lessons from './oliy-ekologiya.json';

export async function importOliyEkologiya(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const filled = await fillLessonContent(prisma, lessons);
  log(`✓ Oliy ta'lim ekologiya: ${filled} ta dars to'ldirildi`);
  return true;
}

/**
 * Bosh sahifa kartalari uchun ilgari yuklangan (past sifatli) rasmlar sozlamasini
 * olib tashlaydi — standart yangi rasmlar (public/images/home/*-v2.jpg) ko'rinadi.
 * Fayllarning o'zi MinIO'da qoladi; SA istalgan vaqtda yangisini yuklay oladi.
 */
export async function resetHomeMedia(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const { count } = await prisma.platformSetting.deleteMany({
    where: { key: { in: ['home_card_eco_image', 'home_card_edu_image'] } },
  });
  log(`✓ Bosh sahifa rasmlari standartga qaytarildi (${count} ta sozlama)`);
  return true;
}
