import type { Prisma } from '@prisma/client';
import type {
  QuizOption,
  QuizQuestionAdminDto,
  QuizQuestionPublicDto,
  QuizSubmissionSummaryDto,
  QuizSummaryDto,
} from '@eco/shared';

export const QUIZ_SUMMARY_SELECT = {
  id: true,
  lessonId: true,
  titleUz: true,
  descriptionUz: true,
  passPercent: true,
  isPublished: true,
  ownerId: true,
  visibility: true,
  timeLimitMinutes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { questions: true, submissions: true } },
} satisfies Prisma.QuizSelect;

export const QUIZ_DETAIL_SELECT = {
  ...QUIZ_SUMMARY_SELECT,
  lesson: {
    select: {
      id: true,
      titleUz: true,
      orderIndex: true,
      course: { select: { id: true, slug: true, nameUz: true } },
    },
  },
} satisfies Prisma.QuizSelect;

export const QUESTION_SELECT = {
  id: true,
  quizId: true,
  orderIndex: true,
  type: true,
  textUz: true,
  options: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuizQuestionSelect;

export const SUBMISSION_SELECT = {
  id: true,
  quizId: true,
  userId: true,
  status: true,
  scoreTotal: true,
  scoreMax: true,
  scorePercent: true,
  passed: true,
  likertSum: true,
  likertMax: true,
  startedAt: true,
  submittedAt: true,
} satisfies Prisma.QuizSubmissionSelect;

export type QuizSummaryRow = Prisma.QuizGetPayload<{ select: typeof QUIZ_SUMMARY_SELECT }>;
export type QuizDetailRow = Prisma.QuizGetPayload<{ select: typeof QUIZ_DETAIL_SELECT }>;
export type QuestionRow = Prisma.QuizQuestionGetPayload<{ select: typeof QUESTION_SELECT }>;
export type SubmissionRow = Prisma.QuizSubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;

/** JSON ustun — eski/buzilgan elementlar jimgina tashlanadi. */
export function parseOptions(raw: Prisma.JsonValue): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const o = item as Record<string, unknown>;
    if (typeof o.key !== 'string' || typeof o.textUz !== 'string') return [];
    return [{ key: o.key, textUz: o.textUz, isCorrect: Boolean(o.isCorrect) }];
  });
}

export function toSummaryDto(row: QuizSummaryRow): QuizSummaryDto {
  return {
    id: row.id,
    lessonId: row.lessonId,
    titleUz: row.titleUz,
    descriptionUz: row.descriptionUz,
    passPercent: row.passPercent,
    isPublished: row.isPublished,
    questionCount: row._count.questions,
    submissionCount: row._count.submissions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLessonContext(row: QuizDetailRow) {
  if (!row.lesson) return null;
  const { id, titleUz, orderIndex, course } = row.lesson;
  return { id, titleUz, orderIndex, course: { id: course.id, slug: course.slug, nameUz: course.nameUz } };
}

export function toAdminQuestionDto(row: QuestionRow): QuizQuestionAdminDto {
  return {
    id: row.id,
    quizId: row.quizId,
    orderIndex: row.orderIndex,
    type: row.type,
    textUz: row.textUz,
    options: parseOptions(row.options),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Talabaga — `isCorrect` hech qachon chiqmaydi (faqat key/textUz ro'yxatlanadi). */
export function toPublicQuestionDto(row: QuestionRow): QuizQuestionPublicDto {
  return {
    ...toAdminQuestionDto(row),
    options: parseOptions(row.options).map(({ key, textUz }) => ({ key, textUz })),
  };
}

export function toSubmissionDto(row: SubmissionRow): QuizSubmissionSummaryDto {
  return {
    id: row.id,
    quizId: row.quizId,
    userId: row.userId,
    status: row.status,
    scoreTotal: row.scoreTotal,
    scoreMax: row.scoreMax,
    scorePercent: row.scorePercent,
    passed: row.passed,
    likertSum: row.likertSum,
    likertMax: row.likertMax,
    startedAt: row.startedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}
