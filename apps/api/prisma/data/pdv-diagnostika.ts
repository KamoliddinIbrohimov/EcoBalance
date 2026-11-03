/**
 * "Pedagogik dasturiy vositalar" fani bo'yicha test va so'rovnoma diagnostikasi
 * (manba: PDV_test_sorovnoma_diagnostika.docx). Hujjat talabiga ko'ra uch
 * komponent natijasi alohida ko'rinishi uchun uchta test:
 *   1) kognitiv — 30 ta test (ballanadi), 2) motivatsion-qiymatli — 20 band,
 *   3) refleksiv-baholash — 10 band (Likert 1–5).
 * Testlar kursning 1-darsiga biriktiriladi va kurs biriktirilgan har guruhga
 * 2 urinish bilan ochiladi (kirish va yakuniy diagnostika).
 *
 * Idempotent: mavjud test (nomi bo'yicha) qayta yaratilmaydi, faqat yetishmayotgan
 * guruh biriktirishlari qo'shiladi. Mavjud natijalarga tegilmaydi.
 */
import type { PrismaClient } from '@prisma/client';

import data from './pdv-diagnostika.json';

const COURSE_SLUG = 'pedagogik-dasturiy-vositalar';
/** Eski seed'dagi 60 savolli birlashgan test — yangi uchtasi bilan almashtiriladi. */
const LEGACY_COMBINED_TITLE = '"Pedagogik dasturiy vositalar" fani bo‘yicha test va so‘rovnoma diagnostikasi';
const ATTEMPTS = 2;

interface QuizSpec {
  titleUz: string;
  descriptionUz: string;
  questions: Array<{ type: 'SINGLE_CHOICE' | 'LIKERT_5'; textUz: string; options: unknown[] }>;
}

const QUIZZES: QuizSpec[] = [
  {
    titleUz: 'PDV diagnostika: 1. Kognitiv komponent (30 ta test)',
    descriptionUz:
      'Pedagogik dasturiy vositalar va tadqiqot asoslari bo‘yicha bilimni aniqlash. Har bir to‘g‘ri javob — 1 ball, ' +
      'maksimal 30 ball. Kirish bosqichida va kurs yakunida topshiriladi.',
    questions: data.cognitive.map((q) => ({ type: 'SINGLE_CHOICE', textUz: q.textUz, options: q.options })),
  },
  {
    titleUz: 'PDV diagnostika: 2. Motivatsion-qiymatli so‘rovnoma (20 band)',
    descriptionUz:
      'Har bir fikrga munosabatingizni belgilang: 1 — mutlaqo qo‘shilmayman; 2 — qo‘shilmayman; 3 — qisman ' +
      'qo‘shilaman; 4 — qo‘shilaman; 5 — to‘liq qo‘shilaman. Maksimal 100 ball.',
    questions: data.motivational.map((textUz) => ({ type: 'LIKERT_5', textUz, options: [] })),
  },
  {
    titleUz: 'PDV diagnostika: 3. Refleksiv-baholash so‘rovi (10 band)',
    descriptionUz:
      'Har bir band uchun belgilang: 1 — deyarli hech qachon; 2 — kamdan-kam; 3 — ba’zan; 4 — ko‘pincha; ' +
      '5 — doimo. Maksimal 50 ball.',
    questions: data.reflexive.map((textUz) => ({ type: 'LIKERT_5', textUz, options: [] })),
  },
];

export async function importPdvDiagnostika(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: { id: true, ownerId: true },
  });
  if (!course) {
    log(`• PDV diagnostika: "${COURSE_SLUG}" kursi topilmadi — o'tkazib yuborildi`);
    return false;
  }
  const lesson = await prisma.lesson.findFirst({
    where: { courseId: course.id, archivedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: { id: true },
  });
  if (!lesson) {
    log('• PDV diagnostika: kursda dars yo‘q — o‘tkazib yuborildi');
    return false;
  }

  const groups = await prisma.courseGroup.findMany({ where: { courseId: course.id }, select: { groupId: true } });

  for (const spec of QUIZZES) {
    let quiz = await prisma.quiz.findFirst({ where: { titleUz: spec.titleUz }, select: { id: true } });
    if (!quiz) {
      quiz = await prisma.quiz.create({
        data: {
          titleUz: spec.titleUz,
          descriptionUz: spec.descriptionUz,
          lessonId: lesson.id,
          ownerId: course.ownerId,
          visibility: 'LIBRARY',
          isPublished: true,
          questions: {
            create: spec.questions.map((q, orderIndex) => ({
              orderIndex,
              type: q.type,
              textUz: q.textUz,
              options: q.options as never,
            })),
          },
        },
        select: { id: true },
      });
      log(`✓ ${spec.titleUz}`);
    }
    await prisma.groupQuiz.createMany({
      data: groups.map((g) => ({ quizId: quiz.id, groupId: g.groupId, maxAttempts: ATTEMPTS })),
      skipDuplicates: true,
    });
  }

  // Eski birlashgan test nashrdan olinadi (natijalari saqlanadi, o'qituvchi ko'radi).
  await prisma.quiz.updateMany({
    where: { titleUz: LEGACY_COMBINED_TITLE, isPublished: true },
    data: { isPublished: false },
  });
  log(`✓ PDV diagnostika: ${QUIZZES.length} ta test, ${groups.length} ta guruhga biriktirildi`);
  return true;
}
