import { BadRequestException, Injectable } from '@nestjs/common';
import type { GradeAssignmentInput } from '@eco/shared';
import { z } from 'zod';

import { AuditService } from '../../infra/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import type { Actor, ClientInfo } from '../auth/actor';
import { applyLatePenalty } from './deadline-policy';
import { LearningAccess } from './learning-access.service';
import { SUBMISSION_SELECT, iso, toSubmissionDto } from './learning.mappers';
import { LearningNotifier } from './learning-notifier';

export const accommodationSchema = z
  .object({
    extraMinutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
    newDueAt: z.coerce.date().nullable().optional(),
  })
  .refine((v) => !!v.extraMinutes || !!v.newDueAt, {
    message: 'extraMinutes yoki newDueAt — birini belgilang',
  });
export type AccommodationInput = z.infer<typeof accommodationSchema>;

/** O'qituvchi tomoni: javoblar ro'yxati, baholash, qayta ochish, alohida uzaytirish. */
@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: LearningAccess,
    private readonly notifier: LearningNotifier,
  ) {}

  async list(assignmentId: string, actor: Actor) {
    await this.access.managedAssignment(assignmentId, actor);
    const rows = await this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      select: { ...SUBMISSION_SELECT, student: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return rows.map(({ student, ...r }) => ({ ...toSubmissionDto(r), student }));
  }

  /** Kechikkan javobga jarima: saqlanadigan ball — jarimadan keyingisi. */
  async grade(submissionId: string, input: GradeAssignmentInput, actor: Actor, client: ClientInfo) {
    const s = await this.access.managedSubmission(submissionId, actor);
    const a = s.assignment;
    if (input.score > a.maxScore) {
      throw new BadRequestException(`Ball maksimaldan oshmasligi kerak (maxScore=${a.maxScore})`);
    }
    const penalty = s.isLate ? a.latePenaltyPercent : 0;
    const score = applyLatePenalty(input.score, s.isLate, a.latePenaltyPercent);

    const row = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score,
        feedbackUz: input.feedbackUz?.trim() || null,
        gradedAt: new Date(),
        gradedById: actor.id,
        status: input.status,
      },
      select: SUBMISSION_SELECT,
    });

    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      subjectType: 'AssignmentSubmission',
      subjectId: submissionId,
      changes: { score, rawScore: input.score, penalty, status: input.status },
      ...client,
    });
    const detail = penalty > 0 ? ` (xom ${input.score} − jarima ${penalty}%)` : '';
    await this.notifier.notify([s.studentId], {
      type: 'assignment.graded',
      titleUz: 'Topshiriq baholandi',
      bodyUz: `"${a.titleUz}" topshirig‘i baholandi: ${score}/${a.maxScore}${detail}`,
      data: { assignmentId: a.id, submissionId, score, rawScore: input.score, penaltyApplied: penalty, maxScore: a.maxScore },
    });
    return toSubmissionDto(row);
  }

  /**
   * Javobni talabaga qaytarish (RETURNED) — talaba qayta topshiradi, attempt
   * o'shanda oshadi. Izoh berilmasa baholashdagi izoh saqlanib qoladi.
   */
  async reopen(submissionId: string, feedbackUz: string | undefined, actor: Actor, client: ClientInfo) {
    const s = await this.access.managedSubmission(submissionId, actor);
    const row = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { status: 'RETURNED', feedbackUz: feedbackUz?.trim() || s.feedbackUz },
      select: SUBMISSION_SELECT,
    });
    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      subjectType: 'AssignmentSubmission',
      subjectId: submissionId,
      changes: { status: 'RETURNED' },
      ...client,
    });
    await this.notifier.notify([s.studentId], {
      type: 'assignment.reopened',
      titleUz: 'Topshiriq qaytarildi',
      bodyUz: `"${s.assignment.titleUz}" topshirig‘i qayta ko‘rib chiqish uchun qaytarildi`,
      data: { assignmentId: s.assignment.id, submissionId },
    });
    return toSubmissionDto(row);
  }

  /** Upsert: berilmagan maydon tozalanadi (oxirgi qaror amal qiladi). */
  async accommodate(assignmentId: string, studentId: string, input: AccommodationInput, actor: Actor, client: ClientInfo) {
    const a = await this.access.managedAssignment(assignmentId, actor);
    const member = await this.access.membership(studentId);
    if (member?.groupId !== a.groupId) throw new BadRequestException('Talaba bu guruh a‘zosi emas');

    const data = { extraMinutes: input.extraMinutes ?? null, newDueAt: input.newDueAt ?? null };
    const row = await this.prisma.assignmentAccommodation.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: { assignmentId, studentId, ...data },
      update: data,
    });
    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      subjectType: 'AssignmentAccommodation',
      subjectId: row.id,
      changes: { studentId, extraMinutes: data.extraMinutes, newDueAt: iso(data.newDueAt) },
      ...client,
    });
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      studentId: row.studentId,
      extraMinutes: row.extraMinutes,
      newDueAt: iso(row.newDueAt),
    };
  }
}
