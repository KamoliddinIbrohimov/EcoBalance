/**
 * Docx'dan generatsiya qilingan dars kontentini mavjud darslarga yozadi.
 * Faqat BO'SH maydonlar to'ldiriladi — o'qituvchi kiritgan matnga tegilmaydi.
 * Nazorat savollari mavjud nazariya oxiriga, hali yo'q bo'lsa, qo'shiladi.
 */
import type { PrismaClient } from '@prisma/client';

export interface LessonContentSource {
  courseSlug: string;
  orderIndex: number;
  objectiveUz: string | null;
  equipmentUz: string | null;
  theoryUz: string | null;
  questions: string[];
  conclusion: string | null;
  /** Nazorat savollaridan keyin keladigan blok (masalan, refleksiya savollari). */
  tail?: string | null;
  procedureUz: string[];
}

const QUESTIONS_HEADING = 'Nazorat savollari';

const questionsBlock = (questions: string[]) =>
  `${QUESTIONS_HEADING}:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

/** Nechta dars yangilanganini qaytaradi. */
export async function fillLessonContent(prisma: PrismaClient, lessons: LessonContentSource[]) {
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
      const parts = [
        src.theoryUz,
        src.questions.length ? questionsBlock(src.questions) : null,
        src.conclusion ? `Xulosa:\n${src.conclusion}` : null,
        src.tail,
      ];
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
  return filled;
}
