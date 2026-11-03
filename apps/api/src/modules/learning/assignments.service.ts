import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AssignmentKind, Prisma } from '@prisma/client';
import type { AssignmentQuery, CreateAssignmentInput, UpdateAssignmentInput } from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { AuditService } from '../../infra/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { type Actor, type ClientInfo, isAdmin, isStudent, isTeacher } from '../auth/actor';
import { LearningAccess } from './learning-access.service';
import { ASSIGNMENT_SELECT, type AssignmentRow, toAssignmentDto } from './learning.mappers';
import { LearningNotifier } from './learning-notifier';
import { assertUploadable, safeFileName, storageKey } from './upload-policy';

/** Topshiriqning tur va jadvalga oid holati (yaratish yoki tahrirdan keyingi). */
interface Shape {
  kind: AssignmentKind;
  dueAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timeLimitMinutes: number | null;
  quizId: string | null;
}

/** Daqiqa aniqligida solishtirish: web forma soniyalarni tashlab yuboradi. */
const sameMinute = (a: Date | null | undefined, b: Date | null | undefined) =>
  Math.floor((a?.getTime() ?? -1) / 60_000) === Math.floor((b?.getTime() ?? -1) / 60_000);

const isPast = (d: Date | null | undefined) => !!d && d.getTime() < Date.now();

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly access: LearningAccess,
    private readonly notifier: LearningNotifier,
  ) {}

  async list(q: AssignmentQuery, actor: Actor) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.AssignmentWhereInput = {
      groupId: q.groupId,
      courseId: q.courseId,
      lessonId: q.lessonId,
      moduleId: q.moduleId,
      titleUz: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };

    if (isTeacher(actor)) {
      where.OR = [{ createdById: actor.id }, { group: { teacherId: actor.id } }];
    } else if (isStudent(actor)) {
      // Talaba — faqat FAOL guruhi, nashrdan olingan kurs topshiriqlari yashirin.
      const member = await this.access.membership(actor.id);
      if (!member?.group.isActive || (q.groupId && q.groupId !== member.groupId)) {
        return toPage([], 0, page, perPage);
      }
      where.groupId = member.groupId;
      where.OR = [{ courseId: null }, { course: { isPublished: true } }];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.assignment.count({ where }),
      this.prisma.assignment.findMany({ where, select: ASSIGNMENT_SELECT, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return toPage(rows.map(toAssignmentDto), total, page, perPage);
  }

  async create(input: CreateAssignmentInput, actor: Actor, client: ClientInfo) {
    const group = await this.prisma.group.findUnique({
      where: { id: input.groupId },
      select: { teacherId: true, isActive: true },
    });
    if (!group || (!isAdmin(actor) && group.teacherId !== actor.id)) throw new NotFoundException('Guruh topilmadi');
    if (!group.isActive) throw new ConflictException('Nofaol guruhga topshiriq yaratib bo‘lmaydi');

    const shape: Shape = {
      kind: input.kind,
      dueAt: input.dueAt ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      timeLimitMinutes: input.timeLimitMinutes ?? null,
      quizId: input.quizId ?? null,
    };
    this.validateSchedule(shape, { dueAt: true, endsAt: true });
    if (shape.kind === 'QUESTIONNAIRE') await this.validateQuiz(shape.quizId, actor);
    const bindings = await this.resolveBindings(input.groupId, input.courseId ?? null, input.lessonId ?? null, input.moduleId ?? null);

    const row = await this.prisma.assignment.create({
      data: {
        ...shape,
        ...bindings,
        groupId: input.groupId,
        createdById: actor.id,
        titleUz: input.titleUz.trim(),
        descriptionUz: input.descriptionUz?.trim() || null,
        maxScore: input.maxScore,
        allowLate: input.allowLate,
        latePenaltyPercent: input.latePenaltyPercent,
      },
      select: ASSIGNMENT_SELECT,
    });

    await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'Assignment', subjectId: row.id, ...client });
    await this.notifier.notifyGroup(row.groupId, {
      type: 'assignment.created',
      titleUz: 'Yangi topshiriq',
      bodyUz: `Guruhingizga yangi topshiriq qo‘shildi: ${row.titleUz}`,
      data: { assignmentId: row.id, groupId: row.groupId },
    });
    return toAssignmentDto(row);
  }

  async update(id: string, input: UpdateAssignmentInput, actor: Actor, client: ClientInfo) {
    const existing = await this.access.managedAssignment(id, actor);

    if (input.kind && input.kind !== existing.kind && existing._count.submissions > 0) {
      throw new ConflictException('Javoblar bor topshiriqning turini o‘zgartirib bo‘lmaydi');
    }
    if (input.maxScore !== undefined && input.maxScore < existing.maxScore) {
      const highest = await this.prisma.assignmentSubmission.aggregate({
        where: { assignmentId: id, score: { not: null } },
        _max: { score: true },
      });
      const max = highest._max.score ?? 0;
      if (max > input.maxScore) {
        throw new ConflictException(`Baholangan ballar bor (eng yuqori ${max}). maxScore'ni ${max} dan past qilib bo‘lmaydi`);
      }
    }

    const pick = <K extends keyof Shape>(k: K): Shape[K] =>
      (input[k] === undefined ? existing[k] : (input[k] ?? null)) as Shape[K];
    const shape: Shape = {
      kind: pick('kind'),
      dueAt: pick('dueAt'),
      startsAt: pick('startsAt'),
      endsAt: pick('endsAt'),
      timeLimitMinutes: pick('timeLimitMinutes'),
      quizId: pick('quizId'),
    };
    // Faqat o'zgargan sanalar "o'tmishda emas" deb tekshiriladi — aks holda muddati
    // o'tgan topshiriqning nomini ham tahrirlab bo'lmasdi.
    this.validateSchedule(shape, {
      dueAt: !sameMinute(shape.dueAt, existing.dueAt),
      endsAt: !sameMinute(shape.endsAt, existing.endsAt),
    });
    if (shape.kind === 'QUESTIONNAIRE' && (shape.quizId !== existing.quizId || shape.kind !== existing.kind)) {
      await this.validateQuiz(shape.quizId, actor);
    }

    const bindingsTouched = input.courseId !== undefined || input.lessonId !== undefined || input.moduleId !== undefined;
    const bindings = bindingsTouched
      ? await this.resolveBindings(
          existing.groupId,
          input.courseId === undefined ? existing.courseId : input.courseId,
          input.lessonId === undefined ? existing.lessonId : input.lessonId,
          input.moduleId === undefined ? existing.moduleId : input.moduleId,
        )
      : {};

    const row = await this.prisma.assignment.update({
      where: { id },
      data: {
        ...shape,
        ...bindings,
        titleUz: input.titleUz?.trim(),
        descriptionUz: input.descriptionUz === undefined ? undefined : input.descriptionUz?.trim() || null,
        maxScore: input.maxScore,
        allowLate: input.allowLate,
        latePenaltyPercent: input.latePenaltyPercent,
      },
      select: ASSIGNMENT_SELECT,
    });

    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      subjectType: 'Assignment',
      subjectId: id,
      changes: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
      ...client,
    });
    if (this.isNotableChange(existing, row)) {
      await this.notifier.notifyGroup(row.groupId, {
        type: 'assignment.updated',
        titleUz: 'Topshiriq yangilandi',
        bodyUz: `"${row.titleUz}" topshirig‘i ma'lumotlari o‘zgardi. Qayta ko‘rib chiqing.`,
        data: { assignmentId: row.id, groupId: row.groupId },
      });
    }
    return toAssignmentDto(row);
  }

  async remove(id: string, actor: Actor, client: ClientInfo): Promise<void> {
    const a = await this.access.managedAssignment(id, actor);
    const [subs, revisions] = await Promise.all([
      this.prisma.assignmentSubmission.findMany({ where: { assignmentId: id, fileKey: { not: null } }, select: { fileKey: true } }),
      this.prisma.assignmentSubmissionRevision.findMany({
        where: { submission: { assignmentId: id }, fileKey: { not: null } },
        select: { fileKey: true },
      }),
    ]);
    await this.prisma.assignment.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'Assignment', subjectId: id, ...client });

    const keys = new Set([a.attachmentKey, ...subs.map((s) => s.fileKey), ...revisions.map((r) => r.fileKey)]);
    for (const key of keys) if (key) await this.storage.remove(key);
  }

  async uploadAttachment(id: string, file: Express.Multer.File | undefined, actor: Actor, client: ClientInfo) {
    assertUploadable(file);
    const a = await this.access.managedAssignment(id, actor);
    const key = storageKey(`assignments/${id}/attachment`, file.originalname);
    const fileName = safeFileName(file.originalname);
    await this.storage.put(key, file.buffer, file.mimetype);
    await this.prisma.assignment.update({ where: { id }, data: { attachmentKey: key, attachmentFileName: fileName } });
    if (a.attachmentKey) await this.storage.remove(a.attachmentKey);
    await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'Assignment', subjectId: id, changes: { attachment: fileName }, ...client });
    return { key, fileName };
  }

  async attachmentUrl(id: string, actor: Actor) {
    const a = await this.access.readableAssignment(id, actor);
    if (!a.attachmentKey) throw new NotFoundException('Fayl topilmadi');
    return { url: await this.storage.downloadUrl(a.attachmentKey, a.attachmentFileName ?? 'attachment') };
  }

  private validateSchedule(s: Shape, changed: { dueAt: boolean; endsAt: boolean }) {
    if (changed.dueAt && isPast(s.dueAt)) {
      throw new BadRequestException('Topshiriq muddati o‘tgan sanaga tayinlanishi mumkin emas');
    }
    if (s.kind === 'TIMED') {
      if (!s.endsAt || !s.timeLimitMinutes) {
        throw new BadRequestException('TIMED turi uchun endsAt va timeLimitMinutes majburiy');
      }
      if (changed.endsAt && isPast(s.endsAt)) throw new BadRequestException('endsAt o‘tmishda bo‘lishi mumkin emas');
      if (s.startsAt) {
        if (s.startsAt >= s.endsAt) throw new BadRequestException('startsAt endsAt dan oldin bo‘lishi kerak');
        const windowMin = (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000;
        if (s.timeLimitMinutes > windowMin) {
          throw new BadRequestException(
            `timeLimitMinutes (${s.timeLimitMinutes}) oyna (${Math.floor(windowMin)} daq)dan uzun`,
          );
        }
      }
    }
    if (s.kind === 'TASK' && s.startsAt && s.dueAt && s.startsAt > s.dueAt) {
      throw new BadRequestException('startsAt dueAt dan keyin bo‘lishi mumkin emas');
    }
    if (s.kind === 'QUESTIONNAIRE' && !s.quizId) {
      throw new BadRequestException('QUESTIONNAIRE turi uchun quizId majburiy');
    }
  }

  /** Faqat o'z yoki LIBRARY testini biriktirish mumkin. */
  private async validateQuiz(quizId: string | null, actor: Actor) {
    const quiz = quizId
      ? await this.prisma.quiz.findUnique({ where: { id: quizId }, select: { ownerId: true, visibility: true } })
      : null;
    if (!quiz) throw new BadRequestException('Test topilmadi');
    if (!isAdmin(actor) && quiz.ownerId !== actor.id && quiz.visibility !== 'LIBRARY') {
      throw new BadRequestException('Faqat o‘z yoki LIBRARY testlarini biriktira olasiz');
    }
  }

  /**
   * Dars/modul/kurs bog'lamlari izchil bo'lsin: dars va modul kursga tegishli,
   * kurs esa shu guruhga biriktirilgan bo'lishi shart.
   */
  private async resolveBindings(groupId: string, courseId: string | null, lessonId: string | null, moduleId: string | null) {
    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { courseId: true, moduleId: true } });
      if (!lesson) throw new BadRequestException('Dars topilmadi');
      if (courseId && courseId !== lesson.courseId) throw new BadRequestException('Dars ko‘rsatilgan kursga tegishli emas');
      if (moduleId && lesson.moduleId && lesson.moduleId !== moduleId) {
        throw new BadRequestException('Modul darsning moduli bilan mos emas');
      }
      courseId = lesson.courseId;
    }
    if (moduleId) {
      const mod = await this.prisma.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
      if (!mod) throw new BadRequestException('Modul topilmadi');
      if (courseId && mod.courseId !== courseId) throw new BadRequestException('Modul ko‘rsatilgan kursga tegishli emas');
      courseId = mod.courseId;
    }
    if (courseId) {
      const link = await this.prisma.courseGroup.findUnique({
        where: { courseId_groupId: { courseId, groupId } },
        select: { courseId: true },
      });
      if (!link) throw new BadRequestException('Kurs bu guruhga biriktirilmagan');
    }
    return { courseId, lessonId, moduleId };
  }

  private isNotableChange(before: AssignmentRow, after: AssignmentRow) {
    return (
      before.titleUz !== after.titleUz ||
      before.descriptionUz !== after.descriptionUz ||
      before.maxScore !== after.maxScore ||
      !sameMinute(before.dueAt, after.dueAt) ||
      !sameMinute(before.endsAt, after.endsAt)
    );
  }
}
