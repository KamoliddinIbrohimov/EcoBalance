import { z } from 'zod';

import { paginationQuerySchema } from './pagination';

export const QUIZ_QUESTION_TYPE = {
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  LIKERT_5: 'LIKERT_5',
} as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPE)[keyof typeof QUIZ_QUESTION_TYPE];

export const QUIZ_QUESTION_TYPE_LABELS_UZ: Record<QuizQuestionType, string> = {
  SINGLE_CHOICE: 'Bitta javobli (A/B/C/D)',
  LIKERT_5: 'Likert shkalasi (1–5)',
};

export const QUIZ_SUBMISSION_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
} as const;
export type QuizSubmissionStatus =
  (typeof QUIZ_SUBMISSION_STATUS)[keyof typeof QUIZ_SUBMISSION_STATUS];

// ---------------------------------------------------------------
// Option / Question shapes
// ---------------------------------------------------------------

/** SINGLE_CHOICE variant — stored in QuizQuestion.options JSON array. */
export const quizOptionSchema = z.object({
  key: z.string().min(1).max(10), // "A" | "B" | "C" | "D" | ...
  textUz: z.string().min(1).max(1000),
  isCorrect: z.boolean(),
});
export type QuizOption = z.infer<typeof quizOptionSchema>;

/** Admin-facing: full question with correct markers visible. */
export const quizQuestionAdminSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  orderIndex: z.number().int().min(0),
  type: z.nativeEnum(QUIZ_QUESTION_TYPE),
  textUz: z.string(),
  options: z.array(quizOptionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QuizQuestionAdminDto = z.infer<typeof quizQuestionAdminSchema>;

/** User-facing: `isCorrect` stripped from options. */
export const quizOptionPublicSchema = quizOptionSchema.omit({ isCorrect: true });
export type QuizOptionPublic = z.infer<typeof quizOptionPublicSchema>;

export const quizQuestionPublicSchema = quizQuestionAdminSchema.extend({
  options: z.array(quizOptionPublicSchema),
});
export type QuizQuestionPublicDto = z.infer<typeof quizQuestionPublicSchema>;

// ---------------------------------------------------------------
// Quiz (summary + detail)
// ---------------------------------------------------------------

export const quizSummarySchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid().nullable(),
  titleUz: z.string(),
  descriptionUz: z.string().nullable(),
  passPercent: z.number().int().min(0).max(100),
  isPublished: z.boolean(),
  questionCount: z.number().int().nonnegative(),
  submissionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type QuizSummaryDto = z.infer<typeof quizSummarySchema>;

/** Lesson info embedded in a quiz detail, so the UI can show breadcrumb. */
export const quizLessonContextSchema = z.object({
  id: z.string().uuid(),
  titleUz: z.string(),
  orderIndex: z.number().int().nonnegative(),
  course: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    nameUz: z.string(),
  }),
});

export const quizAdminDetailSchema = quizSummarySchema.extend({
  lesson: quizLessonContextSchema.nullable(),
  questions: z.array(quizQuestionAdminSchema),
});
export type QuizAdminDetailDto = z.infer<typeof quizAdminDetailSchema>;

/** User-facing detail — correct answers stripped. */
export const quizPublicDetailSchema = quizSummarySchema.extend({
  lesson: quizLessonContextSchema.nullable(),
  questions: z.array(quizQuestionPublicSchema),
});
export type QuizPublicDetailDto = z.infer<typeof quizPublicDetailSchema>;

// ---------------------------------------------------------------
// Admin inputs (create/update quiz + questions)
// ---------------------------------------------------------------

const titleSchema = z.string().trim().min(2, 'Kamida 2 belgi').max(255);

export const createQuizSchema = z.object({
  /** null yoki yo'q bo'lsa — standalone test (Ekologik monitoring bo'limida). */
  lessonId: z.string().uuid().nullable().optional(),
  titleUz: titleSchema,
  descriptionUz: z.string().max(4000).nullable().optional(),
  passPercent: z.coerce.number().int().min(0).max(100).default(60),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

export const updateQuizSchema = z.object({
  titleUz: titleSchema.optional(),
  descriptionUz: z.string().max(4000).nullable().optional(),
  passPercent: z.coerce.number().int().min(0).max(100).optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;

const questionTextSchema = z.string().trim().min(2).max(2000);

const singleChoiceOptionsSchema = z
  .array(quizOptionSchema)
  .min(2, 'Kamida 2 ta variant bo‘lishi kerak')
  .max(6, 'Ko‘pi bilan 6 ta variant')
  .refine((opts: QuizOption[]) => opts.filter((o) => o.isCorrect).length === 1, {
    message: 'Aniq 1 ta to‘g‘ri javob belgilanishi kerak',
  })
  .refine(
    (opts: QuizOption[]) =>
      new Set(opts.map((o) => o.key.toUpperCase())).size === opts.length,
    { message: 'Variant kalitlari takrorlanmasligi kerak' },
  );

const createQuestionBaseSchema = z.object({
  type: z.nativeEnum(QUIZ_QUESTION_TYPE),
  textUz: questionTextSchema,
  orderIndex: z.coerce.number().int().min(0).max(999).optional(),
  options: z.array(quizOptionSchema).optional(),
});
type CreateQuestionBase = z.infer<typeof createQuestionBaseSchema>;

export const createQuestionSchema = createQuestionBaseSchema.superRefine(
  (val: CreateQuestionBase, ctx) => {
    if (val.type === 'SINGLE_CHOICE') {
      const parsed = singleChoiceOptionsSchema.safeParse(val.options ?? []);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ ...issue, path: ['options', ...issue.path] });
        }
      }
    }
    // LIKERT_5 ignores options — UI renders 1..5 implicitly.
  },
);
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    textUz: questionTextSchema.optional(),
    orderIndex: z.coerce.number().int().min(0).max(999).optional(),
    options: z.array(quizOptionSchema).optional(),
  });
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;

// ---------------------------------------------------------------
// Submission inputs/outputs
// ---------------------------------------------------------------

export const submissionAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  // SINGLE_CHOICE: option key. LIKERT_5: "1".."5".
  value: z.string().trim().min(1).max(10),
});
export type SubmissionAnswerInput = z.infer<typeof submissionAnswerInputSchema>;

export const submitQuizSchema = z.object({
  answers: z.array(submissionAnswerInputSchema).min(1),
});
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;

export const quizAnswerSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  value: z.string(),
});
export type QuizAnswerDto = z.infer<typeof quizAnswerSchema>;

export const quizSubmissionSummarySchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.nativeEnum(QUIZ_SUBMISSION_STATUS),
  scoreTotal: z.number().int().nullable(),
  scoreMax: z.number().int().nullable(),
  scorePercent: z.number().int().nullable(),
  passed: z.boolean().nullable(),
  likertSum: z.number().int().nullable(),
  likertMax: z.number().int().nullable(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
});
export type QuizSubmissionSummaryDto = z.infer<typeof quizSubmissionSummarySchema>;

/** Owner-only — their own submission with answers. */
export const quizSubmissionDetailSchema = quizSubmissionSummarySchema.extend({
  answers: z.array(quizAnswerSchema),
});
export type QuizSubmissionDetailDto = z.infer<typeof quizSubmissionDetailSchema>;

/** Admin — submission with user info for the results table. */
export const quizSubmissionWithUserSchema = quizSubmissionSummarySchema.extend({
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }),
});
export type QuizSubmissionWithUserDto = z.infer<typeof quizSubmissionWithUserSchema>;

// ---------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------

export const quizQuerySchema = paginationQuerySchema.extend({
  lessonId: z.string().uuid().optional(),
  /** true — faqat standalone (Monitoring) testlar; false — faqat darsga biriktirilgan. */
  standaloneOnly: z.coerce.boolean().optional(),
  isPublished: z.coerce.boolean().optional(),
});
export type QuizQuery = z.infer<typeof quizQuerySchema>;

export const submissionQuerySchema = paginationQuerySchema;
export type SubmissionQuery = z.infer<typeof submissionQuerySchema>;
