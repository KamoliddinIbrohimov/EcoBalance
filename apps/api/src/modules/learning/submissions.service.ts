import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SubmitAssignmentInput } from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import type { Actor } from '../auth/actor';
import { type Accommodation, attemptDeadline, effectiveDueAt, timedWindowEnd } from './deadline-policy';
import { LearningAccess } from './learning-access.service';
import { type AssignmentRow, SUBMISSION_SELECT, type SubmissionRow, revisionOf, toSubmissionDto } from './learning.mappers';
import { LearningNotifier } from './learning-notifier';
import { assertUploadable, safeFileName, storageKey } from './upload-policy';

/** Javob mazmuni: matn yoki fayl (bittasi). */
type Answer = { textUz: string } | { fileKey: string; fileName: string };

/**
 * Talaba tomoni: matn/fayl topshirish, TIMED urinishni boshlash, o'z javobi.
 *
 * Holatlar: SUBMITTED — baholanguncha tahrirlash mumkin; RETURNED — qayta
 * topshirish (oldingi urinish revision'ga, attempt +1); GRADED va
 * PENDING_REVIEW — yopiq.
 */
@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: LearningAccess,
    private readonly notifier: LearningNotifier,
  ) {}

  async mine(assignmentId: string, actor: Actor) {
    const row = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
      select: SUBMISSION_SELECT,
    });
    return row ? toSubmissionDto(row) : null;
  }

  async submitText(assignmentId: string, input: SubmitAssignmentInput, actor: Actor) {
    const textUz = input.textUz?.trim();
    if (!textUz) throw new BadRequestException('Matn kiritilmagan (fayl yuklash alohida endpointda)');
    const { assignment, existing, isLate } = await this.prepare(assignmentId, actor);
    return this.save(assignment, existing, actor, { textUz }, isLate);
  }

  async submitFile(assignmentId: string, file: Express.Multer.File | undefined, actor: Actor) {
    assertUploadable(file);
    const { assignment, existing, isLate } = await this.prepare(assignmentId, actor);
    const fileKey = storageKey(`submissions/${assignmentId}/${actor.id}`, file.originalname);
    await this.storage.put(fileKey, file.buffer, file.mimetype);
    try {
      return await this.save(assignment, existing, actor, { fileKey, fileName: safeFileName(file.originalname) }, isLate);
    } catch (err) {
      await this.storage.remove(fileKey);
      throw err;
    }
  }

  /**
   * TIMED: server attemptDeadline = min(now + taymer, oyna yopilishi) ni yozadi.
   * Faol urinish bo'lsa o'sha qaytariladi (sahifa yangilansa taymer tiklanadi).
   * RETURNED javob uchun yangi urinish shu yerda ochiladi — aks holda talaba
   * taymerni qayta-qayta boshlab olishi mumkin edi.
   */
  async start(assignmentId: string, actor: Actor) {
    const a = await this.access.studentAssignment(assignmentId, actor);
    if (!a.group.isActive) throw new ConflictException('Guruh nofaol');
    if (a.kind !== 'TIMED') throw new BadRequestException('Faqat TIMED topshiriq uchun');
    if (!a.endsAt || !a.timeLimitMinutes) throw new BadRequestException('TIMED sozlamalari to‘liq emas');

    const now = new Date();
    if (a.startsAt && a.startsAt > now) throw new BadRequestException(`Boshlanish: ${a.startsAt.toISOString()}`);
    const [acc, existing] = await Promise.all([this.accommodation(assignmentId, actor.id), this.current(assignmentId, actor.id)]);
    const windowEnd = timedWindowEnd(a.endsAt, acc);
    if (windowEnd < now) throw new BadRequestException('Test oynasi yopildi');

    if (existing?.attemptDeadline && existing.attemptDeadline > now) return toSubmissionDto(existing);
    if (existing) this.assertOpen(existing);
    if (existing?.status === 'SUBMITTED') {
      throw new ConflictException("TIMED urinish tugagan. Qayta boshlash uchun o'qituvchi topshiriqni ochishi kerak");
    }

    const attempt = { attemptStartedAt: now, attemptDeadline: attemptDeadline(now, a.timeLimitMinutes, acc, windowEnd) };
    if (!existing) {
      const row = await this.prisma.assignmentSubmission.create({
        data: { assignmentId, studentId: actor.id, ...attempt },
        select: SUBMISSION_SELECT,
      });
      return toSubmissionDto(row);
    }
    const [, row] = await this.prisma.$transaction([
      this.prisma.assignmentSubmissionRevision.create({ data: revisionOf(existing) }),
      this.prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { ...this.freshAttempt(existing), ...attempt, submittedAt: now, isLate: false },
        select: SUBMISSION_SELECT,
      }),
    ]);
    return toSubmissionDto(row);
  }

  async fileUrl(submissionId: string, actor: Actor) {
    const s = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        fileKey: true,
        fileName: true,
        studentId: true,
        assignment: { select: { createdById: true, group: { select: { teacherId: true } } } },
      },
    });
    const allowed = s && (s.studentId === actor.id || this.access.canManage(s.assignment, actor));
    if (!allowed || !s.fileKey) throw new NotFoundException('Fayl topilmadi');
    return { url: await this.storage.downloadUrl(s.fileKey, s.fileName ?? 'file') };
  }

  /** Topshirishdan oldingi barcha tekshiruvlar (fayl yuklanishidan oldin). */
  private async prepare(assignmentId: string, actor: Actor) {
    const assignment = await this.access.studentAssignment(assignmentId, actor);
    if (!assignment.group.isActive) throw new ConflictException('Guruh nofaol — topshirishga ruxsat yo‘q');

    const now = new Date();
    const [acc, existing] = await Promise.all([this.accommodation(assignmentId, actor.id), this.current(assignmentId, actor.id)]);
    if (existing) this.assertOpen(existing);

    if (assignment.kind === 'TIMED') {
      // RETURNED'dagi eski urinish deadline'i hisob emas — yangi urinish /start bilan ochiladi.
      const stale = existing?.status === 'RETURNED' && !!existing.attemptDeadline && existing.attemptDeadline < now;
      if (!existing?.attemptDeadline || stale) {
        throw new BadRequestException('TIMED: avval POST /assignments/:id/start chaqirib urinishni boshlang');
      }
      if (existing.attemptDeadline < now) throw new BadRequestException('TIMED: urinish vaqti tugadi');
      if (existing.status === 'SUBMITTED' && (existing.textUz !== null || existing.fileKey !== null)) {
        throw new BadRequestException('TIMED topshiriq topshirilgan — baholanishini kuting');
      }
    } else if (assignment.startsAt && assignment.startsAt > now) {
      throw new BadRequestException('Topshiriq hali boshlanmagan');
    }

    // Kechikish: uzaytirilgan muddat ustun; allowLate bo'lmasa qabul qilinmaydi.
    const due = effectiveDueAt(assignment.dueAt, acc);
    const isLate = !!due && due < now;
    if (isLate && !assignment.allowLate) throw new BadRequestException('Topshiriq muddati o‘tdi');
    return { assignment, existing, isLate };
  }

  private async save(a: AssignmentRow, existing: SubmissionRow | null, actor: Actor, answer: Answer, isLate: boolean) {
    const now = new Date();
    let row: SubmissionRow;
    let replacedFile: string | null = null;

    if (!existing) {
      row = await this.prisma.assignmentSubmission.create({
        data: { assignmentId: a.id, studentId: actor.id, ...answer, isLate, submittedAt: now },
        select: SUBMISSION_SELECT,
      });
    } else if (existing.status === 'RETURNED') {
      // Yangi urinish toza boshlanadi: oldingi matn/fayl revision'da qoladi.
      [, row] = await this.prisma.$transaction([
        this.prisma.assignmentSubmissionRevision.create({ data: revisionOf(existing) }),
        this.prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: { ...this.freshAttempt(existing), ...answer, submittedAt: now, isLate },
          select: SUBMISSION_SELECT,
        }),
      ]);
    } else {
      if ('fileKey' in answer && existing.fileKey !== answer.fileKey) replacedFile = existing.fileKey;
      row = await this.prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { ...answer, submittedAt: now, isLate },
        select: SUBMISSION_SELECT,
      });
    }

    if (replacedFile) await this.storage.remove(replacedFile);
    await this.prisma.studyEvent.create({
      data: { studentId: actor.id, type: 'ASSIGNMENT_SUBMIT', refId: a.id, meta: { attempt: row.attempt, isLate } },
    });
    await this.notifier.notify([a.group.teacherId, a.createdById], {
      type: 'assignment.submitted',
      titleUz: 'Topshiriq qabul qilindi',
      bodyUz: `Talaba "${a.titleUz}" topshirig‘ini topshirdi`,
      data: { assignmentId: a.id, submissionId: row.id, studentId: actor.id },
    });
    return toSubmissionDto(row);
  }

  private freshAttempt(existing: SubmissionRow): Prisma.AssignmentSubmissionUpdateInput {
    return {
      attempt: existing.attempt + 1,
      status: 'SUBMITTED',
      textUz: null,
      fileKey: null,
      fileName: null,
      score: null,
      feedbackUz: null,
      gradedAt: null,
      gradedBy: { disconnect: true },
    };
  }

  private assertOpen(existing: SubmissionRow) {
    if (existing.status === 'GRADED') throw new BadRequestException('Topshiriq baholangandan keyin qayta topshirib bo‘lmaydi');
    if (existing.status === 'PENDING_REVIEW') throw new BadRequestException("Topshiriq o'qituvchi ko'rib chiqishida");
  }

  private current(assignmentId: string, studentId: string) {
    return this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      select: SUBMISSION_SELECT,
    });
  }

  private accommodation(assignmentId: string, studentId: string): Promise<Accommodation | null> {
    return this.prisma.assignmentAccommodation.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      select: { extraMinutes: true, newDueAt: true },
    });
  }
}
