import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateQuestionInput,
  QuizOption,
  ReorderQuestionsInput,
  UpdateQuestionInput,
} from '@eco/shared';

import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { type Actor, isAdmin } from '../auth/actor';
import { QUESTION_SELECT, toAdminQuestionDto } from './quiz.mapper';
import { QuizzesService } from './quizzes.service';

/** Qayta tartiblashda (quizId, orderIndex) unikalligini vaqtincha chetlab o'tish uchun. */
const REORDER_OFFSET = 10_000;

/**
 * createQuestionSchema bilan bir xil qoidalar — update sxemasi variantlarni
 * tekshirmaydi, shuning uchun PATCH'da shu yerda tekshiriladi.
 */
function assertSingleChoiceOptions(options: QuizOption[]) {
  if (options.length < 2) throw new BadRequestException('Kamida 2 ta variant bo‘lishi kerak');
  if (options.length > 6) throw new BadRequestException('Ko‘pi bilan 6 ta variant');
  if (options.filter((o) => o.isCorrect).length !== 1) {
    throw new BadRequestException('Aniq 1 ta to‘g‘ri javob belgilanishi kerak');
  }
  if (new Set(options.map((o) => o.key.toUpperCase())).size !== options.length) {
    throw new BadRequestException('Variant kalitlari takrorlanmasligi kerak');
  }
}

const asJson = (options: QuizOption[]) => options as unknown as Prisma.InputJsonValue;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quizzes: QuizzesService,
  ) {}

  async add(quizId: string, input: CreateQuestionInput, actor: Actor) {
    await this.quizzes.findOwned(quizId, actor);
    const orderIndex =
      input.orderIndex ??
      ((await this.prisma.quizQuestion.aggregate({ where: { quizId }, _max: { orderIndex: true } }))._max
        .orderIndex ?? -1) + 1;
    try {
      const row = await this.prisma.quizQuestion.create({
        data: {
          quizId,
          orderIndex,
          type: input.type,
          textUz: input.textUz.trim(),
          // LIKERT_5 variantsiz — UI 1..5 ni o'zi chizadi.
          options: asJson(input.type === 'SINGLE_CHOICE' ? (input.options ?? []) : []),
        },
        select: QUESTION_SELECT,
      });
      return toAdminQuestionDto(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`orderIndex=${orderIndex} band — boshqa raqam tanlang`);
      throw err;
    }
  }

  async update(questionId: string, input: UpdateQuestionInput, actor: Actor) {
    const existing = await this.findOwnedQuestion(questionId, actor);
    let options: Prisma.InputJsonValue | undefined;
    if (input.options !== undefined) {
      if (existing.type === 'SINGLE_CHOICE') assertSingleChoiceOptions(input.options);
      options = asJson(existing.type === 'SINGLE_CHOICE' ? input.options : []);
    }
    try {
      const row = await this.prisma.quizQuestion.update({
        where: { id: questionId },
        data: { textUz: input.textUz?.trim(), orderIndex: input.orderIndex, options },
        select: QUESTION_SELECT,
      });
      return toAdminQuestionDto(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Bu tartib raqami boshqa savolda ishlatilgan');
      throw err;
    }
  }

  async remove(questionId: string, actor: Actor) {
    await this.findOwnedQuestion(questionId, actor);
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
  }

  async reorder(quizId: string, input: ReorderQuestionsInput, actor: Actor) {
    await this.quizzes.findOwned(quizId, actor);
    const rows = await this.prisma.quizQuestion.findMany({ where: { quizId }, select: { id: true } });
    const existing = new Set(rows.map((r) => r.id));
    const requested = new Set(input.questionIds);
    if (requested.size !== input.questionIds.length) throw new BadRequestException('Savollar takrorlanmasligi kerak');
    const unknown = input.questionIds.find((id) => !existing.has(id));
    if (unknown) throw new BadRequestException(`Savol topilmadi: ${unknown}`);
    if (requested.size !== existing.size) throw new BadRequestException('Ro‘yxatda barcha savollar bo‘lishi kerak');

    // Ikki bosqich: avval hammasini band bo'lmagan diapazonga, keyin yakuniy joyiga.
    await this.prisma.$transaction([
      ...input.questionIds.map((id, i) =>
        this.prisma.quizQuestion.update({ where: { id }, data: { orderIndex: REORDER_OFFSET + i } }),
      ),
      ...input.questionIds.map((id, i) => this.prisma.quizQuestion.update({ where: { id }, data: { orderIndex: i } })),
    ]);
    return { ok: true };
  }

  /** Begona test savoli — 404 (eski xatti-harakat bilan bir xil). */
  private async findOwnedQuestion(id: string, actor: Actor) {
    const q = await this.prisma.quizQuestion.findUnique({
      where: { id },
      select: { id: true, type: true, quiz: { select: { ownerId: true } } },
    });
    if (!q || !(isAdmin(actor) || q.quiz.ownerId === actor.id)) throw new NotFoundException('Savol topilmadi');
    return q;
  }
}
