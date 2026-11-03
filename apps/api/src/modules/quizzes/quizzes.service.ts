import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateQuizInput,
  QuizAdminDetailDto,
  QuizQuery,
  QuizSubmissionWithUserDto,
  SubmissionQuery,
  UpdateQuizInput,
} from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { AuditService } from '../../infra/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import { type Actor, type ClientInfo, isAdmin } from '../auth/actor';
import {
  QUESTION_SELECT,
  QUIZ_DETAIL_SELECT,
  QUIZ_SUMMARY_SELECT,
  SUBMISSION_SELECT,
  toAdminQuestionDto,
  toLessonContext,
  toSubmissionDto,
  toSummaryDto,
} from './quiz.mapper';

interface QuizRef {
  id: string;
  ownerId: string | null;
  visibility: 'PRIVATE' | 'LIBRARY';
}

/**
 * O'qituvchi tomoni: testlarni yaratish/tahrirlash va natijalarni ko'rish.
 * SA — hammasi. O'qituvchi — o'zinikini boshqaradi, LIBRARY testlarni
 * ro'yxatda ko'radi (biriktirish uchun), lekin javob kalitini emas.
 */
@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: QuizQuery, actor: Actor) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.QuizWhereInput = {
      lessonId: q.standaloneOnly ? null : q.lessonId,
      isPublished: q.isPublished,
      titleUz: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
      OR: isAdmin(actor) ? undefined : [{ ownerId: actor.id }, { visibility: 'LIBRARY' }],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quiz.count({ where }),
      this.prisma.quiz.findMany({ where, select: QUIZ_SUMMARY_SELECT, orderBy: { updatedAt: 'desc' }, skip, take }),
    ]);
    return toPage(rows.map(toSummaryDto), total, page, perPage);
  }

  /** Javob kaliti bilan — faqat egasi yoki SA (LIBRARY bo'lsa ham). */
  async detail(id: string, actor: Actor): Promise<QuizAdminDetailDto> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, select: QUIZ_DETAIL_SELECT });
    if (!quiz || !(isAdmin(actor) || quiz.ownerId === actor.id)) throw new NotFoundException('Test topilmadi');
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      orderBy: { orderIndex: 'asc' },
      select: QUESTION_SELECT,
    });
    return { ...toSummaryDto(quiz), lesson: toLessonContext(quiz), questions: questions.map(toAdminQuestionDto) };
  }

  async create(input: CreateQuizInput, actor: Actor, client: ClientInfo) {
    if (input.lessonId) await this.assertLessonUsable(input.lessonId, actor);
    const row = await this.prisma.quiz.create({
      data: {
        lessonId: input.lessonId ?? null,
        titleUz: input.titleUz.trim(),
        descriptionUz: input.descriptionUz?.trim() || null,
        passPercent: input.passPercent,
        ownerId: actor.id,
      },
      select: QUIZ_SUMMARY_SELECT,
    });
    await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'Quiz', subjectId: row.id, ...client });
    return toSummaryDto(row);
  }

  async update(id: string, input: UpdateQuizInput, actor: Actor, client: ClientInfo) {
    await this.findOwned(id, actor);
    const row = await this.prisma.quiz.update({
      where: { id },
      data: {
        titleUz: input.titleUz?.trim(),
        descriptionUz: input.descriptionUz === undefined ? undefined : input.descriptionUz?.trim() || null,
        passPercent: input.passPercent,
        isPublished: input.isPublished,
      },
      select: QUIZ_SUMMARY_SELECT,
    });
    await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'Quiz', subjectId: id, changes: input, ...client });
    return toSummaryDto(row);
  }

  async remove(id: string, actor: Actor, client: ClientInfo) {
    await this.findOwned(id, actor);
    await this.prisma.quiz.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'Quiz', subjectId: id, ...client });
  }

  /**
   * Egasi/SA — barcha topshirishlar. LIBRARY testni o'z guruhiga biriktirgan
   * boshqa o'qituvchi — faqat o'z guruhlari talabalarinikini.
   */
  async submissions(id: string, q: SubmissionQuery, actor: Actor) {
    const quiz = await this.findVisible(id, actor);
    const manages = isAdmin(actor) || quiz.ownerId === actor.id;
    const where: Prisma.QuizSubmissionWhereInput = {
      quizId: id,
      user: manages ? undefined : { groupMembership: { group: { teacherId: actor.id } } },
    };
    const { page, perPage, skip, take } = pageArgs(q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quizSubmission.count({ where }),
      this.prisma.quizSubmission.findMany({
        where,
        select: { ...SUBMISSION_SELECT, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { submittedAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const data: QuizSubmissionWithUserDto[] = rows.map(({ user, ...s }) => ({ ...toSubmissionDto(s), user }));
    return toPage(data, total, page, perPage);
  }

  /** Ko'rinmas test — 404 (mavjudligini oshkor qilmaymiz). */
  async findVisible(id: string, actor: Actor): Promise<QuizRef> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: { id: true, ownerId: true, visibility: true },
    });
    const visible = quiz && (isAdmin(actor) || quiz.ownerId === actor.id || quiz.visibility === 'LIBRARY');
    if (!visible) throw new NotFoundException('Test topilmadi');
    return quiz;
  }

  /** Ko'rinadi, lekin egasi emas (LIBRARY) — 403. */
  async findOwned(id: string, actor: Actor): Promise<QuizRef> {
    const quiz = await this.findVisible(id, actor);
    if (!isAdmin(actor) && quiz.ownerId !== actor.id) {
      throw new ForbiddenException('Faqat o‘z testingizni o‘zgartira olasiz');
    }
    return quiz;
  }

  /** O'qituvchi faqat o'z yoki LIBRARY kursi darsiga test qo'sha oladi. */
  private async assertLessonUsable(lessonId: string, actor: Actor) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { course: { select: { ownerId: true, visibility: true } } },
    });
    const usable =
      lesson && (isAdmin(actor) || lesson.course.ownerId === actor.id || lesson.course.visibility === 'LIBRARY');
    if (!usable) throw new NotFoundException('Dars topilmadi');
  }
}
