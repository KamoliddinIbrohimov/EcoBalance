import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { GroupQuiz } from '@prisma/client';
import type { BindQuizSettingsInput } from '@eco/shared';

import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import type { Actor } from '../auth/actor';
import { GroupAccess, canBindContent } from './group-access.service';
import { assertOpenBeforeClose } from './release-policy';

type QuizSettings = Pick<GroupQuiz, 'opensAt' | 'closesAt' | 'maxAttempts' | 'timeLimitMinutes'>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

function settingsDto(s: QuizSettings) {
  return {
    opensAt: iso(s.opensAt),
    closesAt: iso(s.closesAt),
    maxAttempts: s.maxAttempts,
    timeLimitMinutes: s.timeLimitMinutes,
  };
}

/** Guruhga kurs va test biriktirish. Begona PRIVATE kontent — 404. */
@Injectable()
export class BindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccess,
  ) {}

  // ---- Kurslar ----

  async courses(groupId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const rows = await this.prisma.courseGroup.findMany({
      where: { groupId },
      include: { course: { select: { id: true, slug: true, nameUz: true, isPublished: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ courseId: r.courseId, groupId: r.groupId, course: r.course }));
  }

  async bindCourse(groupId: string, courseId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true, visibility: true },
    });
    if (!course || !canBindContent(course, actor)) throw new NotFoundException('Kurs topilmadi');
    try {
      await this.prisma.courseGroup.create({ data: { courseId, groupId } });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Kurs allaqachon biriktirilgan');
      throw err;
    }
    // Kurs darslaridagi nashr etilgan testlar ham guruhga ochiladi — talaba testni
    // faqat GroupQuiz orqali ko'radi, aks holda dars sahifasida ular chiqmasdi.
    // O'qituvchi keyin urinish/muddatni "Mazmuni" oynasida o'zgartirishi mumkin.
    const lessonQuizzes = await this.prisma.quiz.findMany({
      where: { isPublished: true, lesson: { courseId, archivedAt: null } },
      select: { id: true },
    });
    await this.prisma.groupQuiz.createMany({
      data: lessonQuizzes.map((q) => ({ quizId: q.id, groupId })),
      skipDuplicates: true,
    });
    return { courseId, groupId };
  }

  async unbindCourse(groupId: string, courseId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const { count } = await this.prisma.courseGroup.deleteMany({ where: { groupId, courseId } });
    if (count === 0) throw new NotFoundException('Biriktirilma topilmadi');
  }

  // ---- Testlar ----

  async quizzes(groupId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const rows = await this.prisma.groupQuiz.findMany({
      where: { groupId },
      include: { quiz: { select: { id: true, titleUz: true, isPublished: true, lessonId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ quizId: r.quizId, groupId: r.groupId, quiz: r.quiz, ...settingsDto(r) }));
  }

  async bindQuiz(groupId: string, quizId: string, input: BindQuizSettingsInput, actor: Actor) {
    await this.access.owned(groupId, actor);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { ownerId: true, visibility: true },
    });
    if (!quiz || !canBindContent(quiz, actor)) throw new NotFoundException('Test topilmadi');

    const settings: QuizSettings = {
      opensAt: input.opensAt ?? null,
      closesAt: input.closesAt ?? null,
      maxAttempts: input.maxAttempts ?? null,
      timeLimitMinutes: input.timeLimitMinutes ?? null,
    };
    assertOpenBeforeClose(settings);
    try {
      await this.prisma.groupQuiz.create({ data: { quizId, groupId, ...settings } });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Test allaqachon biriktirilgan');
      throw err;
    }
    return { quizId, groupId };
  }

  /** Qisman PATCH: yuborilmagan maydon o'z joyida qoladi, `null` — tozalaydi. */
  async updateQuiz(groupId: string, quizId: string, input: BindQuizSettingsInput, actor: Actor) {
    await this.access.owned(groupId, actor);
    const where = { quizId_groupId: { quizId, groupId } };
    const link = await this.prisma.groupQuiz.findUnique({ where });
    if (!link) throw new NotFoundException('Biriktirilma topilmadi');

    const patch: Partial<QuizSettings> = {};
    for (const key of ['opensAt', 'closesAt', 'maxAttempts', 'timeLimitMinutes'] as const) {
      if (key in input) (patch as Record<string, unknown>)[key] = input[key] ?? null;
    }
    assertOpenBeforeClose({ ...link, ...patch });

    const row = await this.prisma.groupQuiz.update({ where, data: patch });
    return { quizId, groupId, ...settingsDto(row) };
  }

  async unbindQuiz(groupId: string, quizId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const { count } = await this.prisma.groupQuiz.deleteMany({ where: { groupId, quizId } });
    if (count === 0) throw new NotFoundException('Biriktirilma topilmadi');
  }
}

