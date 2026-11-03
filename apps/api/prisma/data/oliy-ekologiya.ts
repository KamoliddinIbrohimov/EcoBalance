/**
 * Oliy ta'lim ekologiya darslari kontenti (manba: docs/materials/ekologiya/*.docx,
 * 15 ta mashg'ulot): 1–9 → "Ekologiya asoslari", 10–15 → "O'zbekiston tabiati va
 * siyosati". JSON docx'dan generatsiya qilingan (maqsad, jihozlar, nazariya,
 * bajarish tartibi, nazorat savollari, xulosa; "Javob:" bloklari chiqarilgan).
 *
 * Faqat BO'SH maydonlar to'ldiriladi — o'qituvchi kiritgan matnga tegilmaydi.
 * Nazorat savollari mavjud nazariya oxiriga, hali yo'q bo'lsa, qo'shiladi.
 */
import type { PrismaClient } from '@prisma/client';

import lessons from './oliy-ekologiya.json';

const QUESTIONS_HEADING = 'Nazorat savollari';

const questionsBlock = (questions: string[]) =>
  `${QUESTIONS_HEADING}:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

export async function importOliyEkologiya(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  let filled = 0;
  for (const src of lessons) {
    const lesson = await prisma.lesson.findFirst({
      where: { course: { slug: src.courseSlug }, orderIndex: src.orderIndex, archivedAt: null },
      select: { id: true, objectiveUz: true, equipmentUz: true, theoryUz: true, procedureUz: true },
    });
    if (!lesson) continue;

    const data: Record<string, unknown> = {};
    if (!lesson.objectiveUz?.trim() && src.objectiveUz) data.objectiveUz = src.objectiveUz;
    if (!lesson.equipmentUz?.trim() && src.equipmentUz) data.equipmentUz = src.equipmentUz;

    const currentTheory = lesson.theoryUz?.trim() ?? '';
    if (!currentTheory) {
      const parts = [src.theoryUz, src.questions.length ? questionsBlock(src.questions) : null, src.conclusion ? `Xulosa:\n${src.conclusion}` : null];
      const theory = parts.filter(Boolean).join('\n\n');
      if (theory) data.theoryUz = theory;
    } else if (src.questions.length && !currentTheory.includes(QUESTIONS_HEADING)) {
      data.theoryUz = `${currentTheory}\n\n${questionsBlock(src.questions)}`;
    }

    const currentSteps = Array.isArray(lesson.procedureUz) ? lesson.procedureUz : [];
    if (currentSteps.length === 0 && src.procedureUz.length) data.procedureUz = src.procedureUz;

    if (Object.keys(data).length) {
      await prisma.lesson.update({ where: { id: lesson.id }, data });
      filled += 1;
    }
  }
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
