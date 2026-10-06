import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QuizQuestionType,
  QuizSubmissionStatus,
} from '@prisma/client';
import type {
  CreateQuestionInput,
  CreateQuizInput,
  QuizAdminDetailDto,
  QuizAnswerDto,
  QuizOption,
  QuizPublicDetailDto,
  QuizQuery,
  QuizQuestionAdminDto,
  QuizQuestionPublicDto,
  QuizSubmissionDetailDto,
  QuizSubmissionSummaryDto,
  QuizSubmissionWithUserDto,
  QuizSummaryDto,
  ReorderQuestionsInput,
  SubmissionQuery,
  SubmitQuizInput,
  UpdateQuestionInput,
  UpdateQuizInput,
} from '@eco/shared';
import { ROLE } from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const QUIZ_SUMMARY_SELECT = {
  id: true,
  lessonId: true,
  titleUz: true,
  descriptionUz: true,
  passPercent: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { questions: true, submissions: true } },
} satisfies Prisma.QuizSelect;

type QuizSummaryRow = Prisma.QuizGetPayload<{ select: typeof QUIZ_SUMMARY_SELECT }>;

const QUESTION_SELECT = {
  id: true,
  quizId: true,
  orderIndex: true,
  type: true,
  textUz: true,
  options: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuizQuestionSelect;

type QuestionRow = Prisma.QuizQuestionGetPayload<{ select: typeof QUESTION_SELECT }>;

const LESSON_CONTEXT_INCLUDE = {
  lesson: {
    select: {
      id: true,
      titleUz: true,
      orderIndex: true,
      course: { select: { id: true, slug: true, nameUz: true } },
    },
  },
} satisfies Prisma.QuizInclude;

type QuizWithLesson = Prisma.QuizGetPayload<{
  select: typeof QUIZ_SUMMARY_SELECT;
  include: typeof LESSON_CONTEXT_INCLUDE;
}>;

const SUBMISSION_SELECT = {
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

type SubmissionRow = Prisma.QuizSubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;

function parseOptions(raw: Prisma.JsonValue): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): QuizOption | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const obj = item as Record<string, unknown>;
      if (typeof obj.key !== 'string' || typeof obj.textUz !== 'string') return null;
      return {
        key: obj.key,
        textUz: obj.textUz,
        isCorrect: Boolean(obj.isCorrect),
      };
    })
    .filter((o): o is QuizOption => o !== null);
}

function toSummaryDto(row: QuizSummaryRow): QuizSummaryDto {
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

function toAdminQuestionDto(row: QuestionRow): QuizQuestionAdminDto {
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

function toPublicQuestionDto(row: QuestionRow): QuizQuestionPublicDto {
  const admin = toAdminQuestionDto(row);
  return {
    ...admin,
    options: admin.options.map(({ key, textUz }) => ({ key, textUz })),
  };
}

function extractLessonContext(quiz: QuizWithLesson) {
  if (!quiz.lesson) return null;
  return {
    id: quiz.lesson.id,
    titleUz: quiz.lesson.titleUz,
    orderIndex: quiz.lesson.orderIndex,
    course: {
      id: quiz.lesson.course.id,
      slug: quiz.lesson.course.slug,
      nameUz: quiz.lesson.course.nameUz,
    },
  };
}

function toSubmissionDto(row: SubmissionRow): QuizSubmissionSummaryDto {
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

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------------
  // Quiz CRUD (admin)
  // -------------------------------------------------------------

  async list(query: QuizQuery) {
    const { page, perPage, search, lessonId, standaloneOnly, isPublished } = query;

    const where: Prisma.QuizWhereInput = {
      ...(lessonId ? { lessonId } : {}),
      ...(standaloneOnly ? { lessonId: null } : {}),
      ...(typeof isPublished === 'boolean' ? { isPublished } : {}),
      ...(search ? { titleUz: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quiz.count({ where }),
      this.prisma.quiz.findMany({
        where,
        select: QUIZ_SUMMARY_SELECT,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toSummaryDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async listForLessonPublic(lessonId: string): Promise<QuizSummaryDto[]> {
    const rows = await this.prisma.quiz.findMany({
      where: { lessonId, isPublished: true },
      select: QUIZ_SUMMARY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toSummaryDto);
  }

  async getAdminDetail(id: string): Promise<QuizAdminDetailDto> {
    const quiz = await this.loadQuizWithLesson(id);
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      orderBy: { orderIndex: 'asc' },
      select: QUESTION_SELECT,
    });
    return {
      ...toSummaryDto(quiz),
      lesson: extractLessonContext(quiz),
      questions: questions.map(toAdminQuestionDto),
    };
  }

  async getPublicDetail(id: string): Promise<QuizPublicDetailDto> {
    const quiz = await this.loadQuizWithLesson(id);
    if (!quiz.isPublished) throw new NotFoundException('Test topilmadi');

    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      orderBy: { orderIndex: 'asc' },
      select: QUESTION_SELECT,
    });

    return {
      ...toSummaryDto(quiz),
      lesson: extractLessonContext(quiz),
      questions: questions.map(toPublicQuestionDto),
    };
  }

  async listPublishedStandalone(): Promise<QuizSummaryDto[]> {
    const rows = await this.prisma.quiz.findMany({
      where: { isPublished: true, lessonId: null },
      select: QUIZ_SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSummaryDto);
  }

  async create(input: CreateQuizInput): Promise<QuizSummaryDto> {
    if (input.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: { id: true },
      });
      if (!lesson) throw new NotFoundException('Dars topilmadi');
    }

    const row = await this.prisma.quiz.create({
      data: {
        id: uuidv7(),
        lessonId: input.lessonId ?? null,
        titleUz: input.titleUz.trim(),
        descriptionUz: input.descriptionUz?.trim() || null,
        passPercent: input.passPercent ?? 60,
      },
      select: QUIZ_SUMMARY_SELECT,
    });
    return toSummaryDto(row);
  }

  async update(id: string, input: UpdateQuizInput): Promise<QuizSummaryDto> {
    const existing = await this.prisma.quiz.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Test topilmadi');

    const row = await this.prisma.quiz.update({
      where: { id },
      data: {
        ...(input.titleUz !== undefined ? { titleUz: input.titleUz.trim() } : {}),
        ...(input.descriptionUz !== undefined
          ? { descriptionUz: input.descriptionUz?.trim() || null }
          : {}),
        ...(input.passPercent !== undefined ? { passPercent: input.passPercent } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      },
      select: QUIZ_SUMMARY_SELECT,
    });
    return toSummaryDto(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.quiz.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Test topilmadi');
    await this.prisma.quiz.delete({ where: { id } });
  }

  // -------------------------------------------------------------
  // Question CRUD (admin)
  // -------------------------------------------------------------

  async addQuestion(quizId: string, input: CreateQuestionInput): Promise<QuizQuestionAdminDto> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
    if (!quiz) throw new NotFoundException('Test topilmadi');

    const orderIndex =
      input.orderIndex ??
      ((await this.prisma.quizQuestion.aggregate({
        where: { quizId },
        _max: { orderIndex: true },
      }))._max.orderIndex ?? -1) + 1;

    const options =
      input.type === 'SINGLE_CHOICE' ? (input.options ?? []) : [];

    try {
      const row = await this.prisma.quizQuestion.create({
        data: {
          id: uuidv7(),
          quizId,
          orderIndex,
          type: input.type,
          textUz: input.textUz.trim(),
          options: options as unknown as Prisma.InputJsonValue,
        },
        select: QUESTION_SELECT,
      });
      return toAdminQuestionDto(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`orderIndex=${orderIndex} band — boshqa raqam tanlang`);
      }
      throw err;
    }
  }

  async updateQuestion(questionId: string, input: UpdateQuestionInput): Promise<QuizQuestionAdminDto> {
    const existing = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, type: true, quizId: true },
    });
    if (!existing) throw new NotFoundException('Savol topilmadi');

    const data: Prisma.QuizQuestionUpdateInput = {};
    if (input.textUz !== undefined) data.textUz = input.textUz.trim();
    if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;
    if (input.options !== undefined) {
      if (existing.type === 'LIKERT_5') {
        // Allow setting empty options on LIKERT; ignore any payload.
        data.options = [] as unknown as Prisma.InputJsonValue;
      } else {
        if (input.options.filter((o) => o.isCorrect).length !== 1) {
          throw new BadRequestException('Aniq 1 ta to‘g‘ri javob belgilanishi kerak');
        }
        data.options = input.options as unknown as Prisma.InputJsonValue;
      }
    }

    try {
      const row = await this.prisma.quizQuestion.update({
        where: { id: questionId },
        data,
        select: QUESTION_SELECT,
      });
      return toAdminQuestionDto(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu tartib raqami boshqa savolda ishlatilgan');
      }
      throw err;
    }
  }

  async removeQuestion(questionId: string): Promise<void> {
    const existing = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Savol topilmadi');
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
  }

  async reorderQuestions(quizId: string, input: ReorderQuestionsInput): Promise<void> {
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId },
      select: { id: true },
    });
    const existingIds = new Set(questions.map((q) => q.id));
    for (const id of input.questionIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(`Savol topilmadi: ${id}`);
      }
    }
    if (input.questionIds.length !== existingIds.size) {
      throw new BadRequestException('Ro‘yxatda barcha savollar bo‘lishi kerak');
    }

    // Two-pass update: push every row to a high index first (to clear the
    // unique [quizId, orderIndex] constraint), then set the final indices.
    const OFFSET = 1000;
    await this.prisma.$transaction([
      ...input.questionIds.map((id, idx) =>
        this.prisma.quizQuestion.update({
          where: { id },
          data: { orderIndex: idx + OFFSET },
        }),
      ),
      ...input.questionIds.map((id, idx) =>
        this.prisma.quizQuestion.update({
          where: { id },
          data: { orderIndex: idx },
        }),
      ),
    ]);
  }

  // -------------------------------------------------------------
  // Submissions (student + admin)
  // -------------------------------------------------------------

  async submit(
    quizId: string,
    userId: string,
    input: SubmitQuizInput,
  ): Promise<QuizSubmissionSummaryDto> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, isPublished: true, titleUz: true, passPercent: true },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException('Test topilmadi');

    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId },
      select: { id: true, type: true, options: true },
    });
    if (questions.length === 0) {
      throw new BadRequestException('Testda savollar yo‘q');
    }

    // Map answers by questionId for quick lookup, drop unknown questions.
    const answerMap = new Map<string, string>();
    for (const ans of input.answers) {
      answerMap.set(ans.questionId, ans.value.trim());
    }

    let scoreTotal = 0;
    let scoreMax = 0;
    let likertSum = 0;
    let likertMax = 0;
    const normalizedAnswers: Array<{
      questionId: string;
      value: string;
    }> = [];

    for (const q of questions) {
      const raw = answerMap.get(q.id);
      if (q.type === QuizQuestionType.SINGLE_CHOICE) {
        scoreMax += 1;
        if (!raw) continue; // unanswered → 0 for this question
        const value = raw.toUpperCase();
        const options = parseOptions(q.options);
        const chosen = options.find((o) => o.key.toUpperCase() === value);
        if (!chosen) {
          throw new BadRequestException(`Savol ${q.id}: variant topilmadi (${value})`);
        }
        if (chosen.isCorrect) scoreTotal += 1;
        normalizedAnswers.push({ questionId: q.id, value });
      } else if (q.type === QuizQuestionType.LIKERT_5) {
        likertMax += 5;
        if (!raw) continue;
        const num = Number(raw);
        if (!Number.isInteger(num) || num < 1 || num > 5) {
          throw new BadRequestException(`Savol ${q.id}: Likert qiymati 1..5 oralig‘ida bo‘lishi kerak`);
        }
        likertSum += num;
        normalizedAnswers.push({ questionId: q.id, value: String(num) });
      }
    }

    const hasScored = scoreMax > 0;
    const scorePercent = hasScored ? Math.round((scoreTotal / scoreMax) * 100) : null;
    const passed = hasScored ? scorePercent! >= quiz.passPercent : null;
    const hasLikert = likertMax > 0;

    const submissionId = uuidv7();
    const now = new Date();

    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quizSubmission.create({
        data: {
          id: submissionId,
          quizId,
          userId,
          status: QuizSubmissionStatus.SUBMITTED,
          scoreTotal: hasScored ? scoreTotal : null,
          scoreMax: hasScored ? scoreMax : null,
          scorePercent: hasScored ? scorePercent : null,
          passed,
          likertSum: hasLikert ? likertSum : null,
          likertMax: hasLikert ? likertMax : null,
          startedAt: now,
          submittedAt: now,
        },
        select: SUBMISSION_SELECT,
      });

      if (normalizedAnswers.length > 0) {
        await tx.quizAnswer.createMany({
          data: normalizedAnswers.map((a) => ({
            id: uuidv7(),
            submissionId,
            questionId: a.questionId,
            value: a.value,
          })),
        });
      }

      return created;
    });

    // Notify super admins — awaited but failures are logged, not rethrown
    // (user shouldn't see a notification error after a successful submit).
    void this.notifyAdmins(quiz.titleUz, submission).catch((err) => {
      this.logger.error({ err, submissionId }, 'Failed to broadcast QUIZ_SUBMITTED');
    });

    return toSubmissionDto(submission);
  }

  async getSubmissionForUser(
    submissionId: string,
    userId: string,
  ): Promise<QuizSubmissionDetailDto> {
    const row = await this.prisma.quizSubmission.findUnique({
      where: { id: submissionId },
      select: {
        ...SUBMISSION_SELECT,
        answers: { select: { id: true, questionId: true, value: true } },
      },
    });
    if (!row) throw new NotFoundException('Topshiriq topilmadi');
    if (row.userId !== userId) throw new ForbiddenException('Bu topshiriqni ko‘ra olmaysiz');

    return {
      ...toSubmissionDto(row),
      answers: row.answers.map(
        (a): QuizAnswerDto => ({ id: a.id, questionId: a.questionId, value: a.value }),
      ),
    };
  }

  async listMySubmissions(
    quizId: string,
    userId: string,
  ): Promise<QuizSubmissionSummaryDto[]> {
    const rows = await this.prisma.quizSubmission.findMany({
      where: { quizId, userId },
      select: SUBMISSION_SELECT,
      orderBy: { submittedAt: 'desc' },
    });
    return rows.map(toSubmissionDto);
  }

  async listSubmissionsAdmin(quizId: string, query: SubmissionQuery) {
    const { page, perPage } = query;
    const where: Prisma.QuizSubmissionWhereInput = { quizId };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quizSubmission.count({ where }),
      this.prisma.quizSubmission.findMany({
        where,
        select: {
          ...SUBMISSION_SELECT,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const data: QuizSubmissionWithUserDto[] = rows.map((r) => ({
      ...toSubmissionDto(r),
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
      },
    }));

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  // -------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------

  private async loadQuizWithLesson(id: string): Promise<QuizWithLesson> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: { ...QUIZ_SUMMARY_SELECT, ...LESSON_CONTEXT_INCLUDE },
    });
    if (!quiz) throw new NotFoundException('Test topilmadi');
    return quiz as QuizWithLesson;
  }

  private async notifyAdmins(quizTitle: string, submission: SubmissionRow) {
    const user = await this.prisma.user.findUnique({
      where: { id: submission.userId },
      select: { firstName: true, lastName: true, email: true },
    });
    const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Foydalanuvchi';

    const bodyParts: string[] = [`${fullName} «${quizTitle}» testini topshirdi.`];
    if (submission.scorePercent !== null) {
      bodyParts.push(`Natija: ${submission.scorePercent}% (${submission.scoreTotal}/${submission.scoreMax}).`);
    }

    await this.notifications.broadcast({
      type: 'QUIZ_SUBMITTED',
      titleUz: 'Yangi test topshirildi',
      bodyUz: bodyParts.join(' '),
      data: {
        submissionId: submission.id,
        quizId: submission.quizId,
        userId: submission.userId,
        scorePercent: submission.scorePercent,
      },
      toRoles: [ROLE.SUPER_ADMIN, ROLE.ADMIN],
    });
  }
}
