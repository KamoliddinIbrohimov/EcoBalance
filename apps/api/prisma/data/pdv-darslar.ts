/**
 * "Pedagogik dasturiy vositalar" darslari kontenti (manba: docs/materials/pedagogik/
 * Ma'ruzalar 1–15 → 1–15-dars, Amaliy mashg'ulotlar 1–7 → 16–22-dars). Docx fayllar
 * darslarga allaqachon biriktirilgan — bu yerda dars sahifasidagi matn to'ldiriladi:
 * maqsad, vositalar, nazariya (reja, xulosa), nazorat va refleksiya savollari,
 * bajarish tartibi / tadqiqot topshirig'i.
 */
import type { PrismaClient } from '@prisma/client';

import { fillLessonContent } from './lesson-content';
import lessons from './pdv-darslar.json';

export async function importPdvDarslar(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const filled = await fillLessonContent(prisma, lessons);
  log(`✓ Pedagogik dasturiy vositalar: ${filled} ta dars to'ldirildi`);
  return true;
}
