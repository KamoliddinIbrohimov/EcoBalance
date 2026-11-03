import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  QuizPublicDetailDto,
  QuizSubmissionDetailDto,
  QuizSummaryDto,
  SubmitQuizInput,
} from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import type { Actor } from '../auth/actor';
import {
  QUESTION_SELECT,
  QUIZ_DETAIL_SELECT,
  QUIZ_SUMMARY_SELECT,
  SUBMISSION_SELECT,
  parseOptions,
  toLessonContext,
  toPublicQuestionDto,
  toSubmissionDto,
  toSummaryDto,
} from './quiz.mapper';
import { scoreSubmission } from './scoring';
import { SubmissionEffectsService } from './submission-effects.service';

const BINDING_SELECT = { opensAt: true, closesAt: true, maxAttempts: true, timeLimitMinutes: true } as const;

/**
 * Talaba tomoni. Testga kirish faqat o'z guruhiga GroupQuiz orqali
 * biriktirilgan bo'lsa; aks holda 404. Rol cheklovi yo'q (eski API kabi):
 * guruh a'zosi bo'lmagan SA/o'qituvchi bo'sh ro'yxat va 404 oladi.
 */
@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effects: SubmissionEffectsService,
  ) {}

  async byLesson(lessonId: string, actor: Actor): Promise<QuizSummaryDto[]> {
    const groupId = await this.groupIdOf(actor.id);
    if (!groupId) return [];
    const rows = await this.prisma.quiz.findMany({
      where: { lessonId, isPublished: true, groups: { some: { groupId } } },
      select: QUIZ_SUMMARY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toSummaryDto);
  }

  /** Mustaqil testlar + guruh sozlamalari va ishlatilgan urinishlar soni. */
  async standalone(actor: Actor) {
    const groupId = await this.groupIdOf(actor.id);
    if (!groupId) return [];
    const rows = await this.prisma.quiz.findMany({
      where: { lessonId: null, isPublished: true, groups: { some: { groupId } } },
      select: { ...QUIZ_SUMMARY_SELECT, groups: { where: { groupId }, select: BINDING_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    const used = await this.prisma.quizSubmission.groupBy({
      by: ['quizId'],
      where: { userId: actor.id, quizId: { in: rows.map((r) => r.id) }, status: 'SUBMITTED' },
      _count: { _all: true },
    });
    const usedBy = new Map(used.map((u) => [u.quizId, u._count._all]));
    return rows.map(({ groups: [b], ...quiz }) => ({
      ...toSummaryDto(quiz),
      binding: b
        ? {
            opensAt: b.opensAt?.toISOString() ?? null,
            closesAt: b.closesAt?.toISOString() ?? null,
            maxAttempts: b.maxAttempts,
            timeLimitMinutes: b.timeLimitMinutes ?? quiz.timeLimitMinutes,
            attemptsUsed: usedBy.get(quiz.id) ?? 0,
          }
        : undefined,
    }));
  }

  /**
   * Savollar to'g'ri javobsiz. Oyna yopilgach faqat avval topshirgan talaba
   * ochadi — natija sahifasi savollarni shu endpoint orqali oladi.
   */
  async take(id: string, actor: Actor): Promise<QuizPublicDetailDto> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, select: QUIZ_DETAIL_SELECT });
    if (!quiz?.isPublished) throw new NotFoundException('Test topilmadi');
    const binding = await this.binding(id, actor.id);
    const now = Date.now();
    if (binding.opensAt && binding.opensAt.getTime() > now) {
      throw new ForbiddenException(`Test ${binding.opensAt.toISOString()} dan ochiladi`);
    }
    if (binding.closesAt && binding.closesAt.getTime() < now) {
      const submitted = await this.prisma.quizSubmission.count({ where: { quizId: id, userId: actor.id } });
      if (!submitted) throw new ForbiddenException('Test oynasi yopildi');
    }
    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      orderBy: { orderIndex: 'asc' },
      select: QUESTION_SELECT,
    });
    return { ...toSummaryDto(quiz), lesson: toLessonContext(quiz), questions: questions.map(toPublicQuestionDto) };
  }

  async submit(id: string, input: SubmitQuizInput, actor: Actor) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: { id: true, isPublished: true, titleUz: true, passPercent: true, ownerId: true },
    });
    if (!quiz?.isPublished) throw new NotFoundException('Test topilmadi');
    const binding = await this.binding(id, actor.id);
    const now = new Date();
    if (binding.opensAt && binding.opensAt > now) {
      throw new BadRequestException(`Test ${binding.opensAt.toISOString()} dan ochiladi`);
    }
    if (binding.closesAt && binding.closesAt < now) throw new BadRequestException("Test topshirish muddati o'tdi");

    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: id },
      select: { id: true, type: true, options: true },
    });
    const result = scoreSubmission(
      questions.map((q) => ({ id: q.id, type: q.type, options: parseOptions(q.options) })),
      input.answers,
      quiz.passPercent,
    );
    const { answers, ...scores } = result;

    // Parallel topshirishlar maxAttempts'ni chetlab o'tmasligi uchun
    // (quiz, talaba) juftligi bo'yicha tranzaksiya qulfi.
    const submission = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quiz-submit:${id}:${actor.id}`}))`;
      if (binding.maxAttempts) {
        const taken = await tx.quizSubmission.count({ where: { quizId: id, userId: actor.id, status: 'SUBMITTED' } });
        if (taken >= binding.maxAttempts) {
          throw new BadRequestException(`Urinishlar soni to'ldi (${binding.maxAttempts})`);
        }
      }
      return tx.quizSubmission.create({
        data: {
          quizId: id,
          userId: actor.id,
          status: 'SUBMITTED',
          ...scores,
          startedAt: now,
          submittedAt: now,
          answers: { create: answers },
        },
        select: SUBMISSION_SELECT,
      });
    });

    await this.effects.afterSubmit({ quiz, submission, groupId: binding.groupId, teacherId: binding.teacherId });
    return toSubmissionDto(submission);
  }

  async mySubmissions(quizId: string, actor: Actor) {
    const rows = await this.prisma.quizSubmission.findMany({
      where: { quizId, userId: actor.id },
      select: SUBMISSION_SELECT,
      orderBy: { submittedAt: 'desc' },
    });
    return rows.map(toSubmissionDto);
  }

  async submission(id: string, actor: Actor): Promise<QuizSubmissionDetailDto> {
    const row = await this.prisma.quizSubmission.findUnique({
      where: { id },
      select: { ...SUBMISSION_SELECT, answers: { select: { id: true, questionId: true, value: true } } },
    });
    if (!row || row.userId !== actor.id) throw new NotFoundException('Topshiriq topilmadi');
    const { answers, ...summary } = row;
    return { ...toSubmissionDto(summary), answers };
  }

  private async groupIdOf(userId: string) {
    const m = await this.prisma.groupMember.findUnique({ where: { studentId: userId }, select: { groupId: true } });
    return m?.groupId ?? null;
  }

  /** Talaba guruhining shu testga biriktirilishi; yo'q bo'lsa — 404. */
  private async binding(quizId: string, userId: string) {
    const m = await this.prisma.groupMember.findUnique({
      where: { studentId: userId },
      select: {
        groupId: true,
        group: { select: { isActive: true, teacherId: true, quizzes: { where: { quizId }, select: BINDING_SELECT } } },
      },
    });
    const b = m?.group.quizzes[0];
    if (!m || !b) throw new NotFoundException('Test topilmadi');
    if (!m.group.isActive) throw new ForbiddenException('Guruh nofaol');
    return { ...b, groupId: m.groupId, teacherId: m.group.teacherId };
  }
}
