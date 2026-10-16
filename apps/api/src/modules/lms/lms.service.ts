import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentSubmissionStatus,
  Prisma,
} from '@prisma/client';
import type {
  AssignmentDto,
  AssignmentQuery,
  AssignmentSubmissionDto,
  AssignmentSubmissionWithStudentDto,
  CreateAssignmentInput,
  GradeAssignmentInput,
  GroupStatsDto,
  StudentStatsDto,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface Actor {
  id: string;
  roles: string[];
}

const ASSIGNMENT_SELECT = {
  id: true,
  courseId: true,
  lessonId: true,
  moduleId: true,
  groupId: true,
  createdById: true,
  kind: true,
  titleUz: true,
  descriptionUz: true,
  dueAt: true,
  maxScore: true,
  attachmentKey: true,
  attachmentFileName: true,
  allowLate: true,
  latePenaltyPercent: true,
  startsAt: true,
  endsAt: true,
  timeLimitMinutes: true,
  quizId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { submissions: true } },
} satisfies Prisma.AssignmentSelect;

type AssignmentRow = Prisma.AssignmentGetPayload<{ select: typeof ASSIGNMENT_SELECT }>;

function toAssignmentDto(r: AssignmentRow): AssignmentDto {
  return {
    id: r.id,
    courseId: r.courseId,
    lessonId: r.lessonId,
    moduleId: r.moduleId,
    groupId: r.groupId,
    createdById: r.createdById,
    kind: r.kind,
    titleUz: r.titleUz,
    descriptionUz: r.descriptionUz,
    dueAt: r.dueAt?.toISOString() ?? null,
    maxScore: r.maxScore,
    attachmentKey: r.attachmentKey,
    attachmentFileName: r.attachmentFileName,
    allowLate: r.allowLate,
    latePenaltyPercent: r.latePenaltyPercent,
    startsAt: r.startsAt?.toISOString() ?? null,
    endsAt: r.endsAt?.toISOString() ?? null,
    timeLimitMinutes: r.timeLimitMinutes,
    quizId: r.quizId,
    submissionCount: r._count.submissions,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SUBMISSION_SELECT = {
  id: true,
  assignmentId: true,
  studentId: true,
  textUz: true,
  fileKey: true,
  fileName: true,
  submittedAt: true,
  score: true,
  feedbackUz: true,
  gradedById: true,
  gradedAt: true,
  status: true,
  attempt: true,
  attemptStartedAt: true,
  attemptDeadline: true,
  isLate: true,
} satisfies Prisma.AssignmentSubmissionSelect;

type SubmissionRow = Prisma.AssignmentSubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;

function toSubmissionDto(r: SubmissionRow): AssignmentSubmissionDto {
  return {
    id: r.id,
    assignmentId: r.assignmentId,
    studentId: r.studentId,
    textUz: r.textUz,
    fileKey: r.fileKey,
    fileName: r.fileName,
    submittedAt: r.submittedAt.toISOString(),
    score: r.score,
    feedbackUz: r.feedbackUz,
    gradedById: r.gradedById,
    gradedAt: r.gradedAt?.toISOString() ?? null,
    status: r.status,
    attempt: r.attempt,
    attemptStartedAt: r.attemptStartedAt?.toISOString() ?? null,
    attemptDeadline: r.attemptDeadline?.toISOString() ?? null,
    isLate: r.isLate,
  };
}

@Injectable()
export class LmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // -------- F4 (L14) File upload / download --------

  private static readonly ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]);
  private static readonly MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

  async uploadAssignmentAttachment(
    assignmentId: string,
    file: Express.Multer.File | undefined,
    actor: Actor,
  ) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    if (file.size > LmsService.MAX_FILE_BYTES) {
      throw new BadRequestException('Fayl 10 MB dan oshmasligi kerak');
    }
    if (!LmsService.ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Mumkin bo‘lmagan fayl turi: ${file.mimetype}`);
    }
    const a = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { createdById: true, group: { select: { teacherId: true } } },
    });
    if (!a) throw new NotFoundException('Topshiriq topilmadi');
    if (!this.isSuperAdmin(actor) && a.createdById !== actor.id && a.group.teacherId !== actor.id) {
      throw new ForbiddenException("Faqat o'z topshirig'ingizga fayl biriktira olasiz");
    }
    const key = `assignments/${assignmentId}/attachment-${uuidv7()}-${file.originalname}`;
    await this.storage.upload(key, file.buffer, file.mimetype);
    await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: { attachmentKey: key, attachmentFileName: file.originalname },
    });
    return { key, fileName: file.originalname };
  }

  async getAssignmentAttachmentUrl(assignmentId: string, actor: Actor): Promise<{ url: string }> {
    const a = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        attachmentKey: true,
        attachmentFileName: true,
        groupId: true,
        createdById: true,
        group: { select: { teacherId: true } },
      },
    });
    if (!a || !a.attachmentKey) throw new NotFoundException('Fayl topilmadi');

    // N3: TEACHER faqat o'z yaratgan / o'z guruhi topshirig'ini ko'ra oladi
    if (this.isTeacher(actor)) {
      if (a.createdById !== actor.id && a.group.teacherId !== actor.id) {
        throw new NotFoundException('Fayl topilmadi');
      }
    }
    // Student: faqat o'z guruhi topshirig'i uchun
    if (this.isStudent(actor)) {
      const member = await this.prisma.groupMember.findUnique({
        where: { studentId: actor.id },
        select: { groupId: true },
      });
      if (!member || member.groupId !== a.groupId) {
        throw new NotFoundException('Fayl topilmadi');
      }
    }
    const url = await this.storage.getDownloadUrl(a.attachmentKey, a.attachmentFileName ?? 'attachment');
    return { url };
  }

  async uploadSubmissionFile(
    assignmentId: string,
    file: Express.Multer.File | undefined,
    actor: Actor,
  ): Promise<AssignmentSubmissionDto> {
    if (!this.isStudent(actor)) throw new ForbiddenException('Faqat talaba');
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    if (file.size > LmsService.MAX_FILE_BYTES) {
      throw new BadRequestException('Fayl 10 MB dan oshmasligi kerak');
    }
    if (!LmsService.ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Mumkin bo‘lmagan fayl turi: ${file.mimetype}`);
    }
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        groupId: true,
        dueAt: true,
        allowLate: true,
        group: { select: { isActive: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi');
    if (!assignment.group.isActive) {
      throw new ConflictException('Guruh nofaol');
    }
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId: actor.id },
      select: { groupId: true },
    });
    if (!member || member.groupId !== assignment.groupId) {
      throw new ForbiddenException('Bu topshiriq sizning guruhingizga tegishli emas');
    }
    const now = Date.now();
    let isLate = false;
    if (assignment.dueAt && assignment.dueAt.getTime() < now) {
      if (!assignment.allowLate) throw new BadRequestException('Topshiriq muddati o‘tdi');
      isLate = true;
    }
    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
    });
    if (existing && existing.status === AssignmentSubmissionStatus.GRADED) {
      throw new BadRequestException('Baholangan topshiriqga fayl qo‘shib bo‘lmaydi');
    }
    const key = `submissions/${assignmentId}/${actor.id}/${uuidv7()}-${file.originalname}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    const row = existing
      ? await this.prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            fileKey: key,
            fileName: file.originalname,
            submittedAt: new Date(),
            status: AssignmentSubmissionStatus.SUBMITTED,
            isLate,
          },
          select: SUBMISSION_SELECT,
        })
      : await this.prisma.assignmentSubmission.create({
          data: {
            id: uuidv7(),
            assignmentId,
            studentId: actor.id,
            fileKey: key,
            fileName: file.originalname,
            attempt: 1,
            isLate,
          },
          select: SUBMISSION_SELECT,
        });
    return toSubmissionDto(row);
  }

  async getSubmissionFileUrl(submissionId: string, actor: Actor): Promise<{ url: string }> {
    const sub = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        fileKey: true,
        fileName: true,
        studentId: true,
        assignment: {
          select: { createdById: true, group: { select: { teacherId: true } } },
        },
      },
    });
    if (!sub || !sub.fileKey) throw new NotFoundException('Fayl topilmadi');
    const isOwner = sub.studentId === actor.id;
    const canGrade =
      this.isSuperAdmin(actor) ||
      sub.assignment.createdById === actor.id ||
      sub.assignment.group.teacherId === actor.id;
    if (!isOwner && !canGrade) throw new ForbiddenException('Ko‘rish huquqingiz yo‘q');
    const url = await this.storage.getDownloadUrl(sub.fileKey, sub.fileName ?? 'file');
    return { url };
  }

  private isSuperAdmin(actor: Actor) {
    return actor.roles.includes('SUPER_ADMIN');
  }
  private isTeacher(actor: Actor) {
    return actor.roles.includes('TEACHER') && !this.isSuperAdmin(actor);
  }
  private isStudent(actor: Actor) {
    return actor.roles.includes('STUDENT') && !this.isSuperAdmin(actor);
  }

  // -------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------

  async listAssignments(query: AssignmentQuery, actor: Actor) {
    const { page, perPage, search, groupId, courseId, lessonId } = query;

    const where: Prisma.AssignmentWhereInput = {
      ...(groupId ? { groupId } : {}),
      ...(courseId ? { courseId } : {}),
      ...(lessonId ? { lessonId } : {}),
      ...(search ? { titleUz: { contains: search, mode: 'insensitive' } } : {}),
    };

    if (this.isTeacher(actor)) {
      // Teacher o'zi yaratgan topshiriqlar yoki o'z guruhlariga tegishli
      where.OR = [
        { createdById: actor.id },
        { group: { teacherId: actor.id } },
      ];
    } else if (this.isStudent(actor)) {
      // Student faqat o'z FAOL guruhidagi topshiriqlar (L9).
      const membership = await this.prisma.groupMember.findUnique({
        where: { studentId: actor.id },
        select: { groupId: true, group: { select: { isActive: true } } },
      });
      if (!membership || !membership.group.isActive) {
        return { data: [], meta: { page, perPage, total: 0, totalPages: 1 } };
      }
      where.groupId = membership.groupId;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.assignment.count({ where }),
      this.prisma.assignment.findMany({
        where,
        select: ASSIGNMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toAssignmentDto),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async createAssignment(input: CreateAssignmentInput, actor: Actor): Promise<AssignmentDto> {
    if (this.isStudent(actor)) {
      throw new ForbiddenException('Talaba topshiriq yarata olmaydi');
    }

    if (input.dueAt && input.dueAt.getTime() < Date.now()) {
      throw new BadRequestException('Topshiriq muddati o‘tgan sanaga tayinlanishi mumkin emas');
    }

    const group = await this.prisma.group.findUnique({
      where: { id: input.groupId },
      select: { teacherId: true, isActive: true },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    // L9: nofaol guruhda yangi topshiriq yaratib bo'lmaydi
    if (!group.isActive) {
      throw new ConflictException('Nofaol guruhga topshiriq yaratib bo‘lmaydi');
    }
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Faqat o‘z guruhlaringizga topshiriq yaratishingiz mumkin');
    }

    // L5: lesson/course bog'lamlari izchil bo'lsin
    //  - lessonId berilsa, uning courseId'si CourseGroup orqali SHU guruhga biriktirilgan
    //    bo'lishi kerak; agar courseId ham berilgan bo'lsa, mos kelishi kerak.
    //  - courseId berilsa (lesson'siz) — shu kurs guruhga biriktirilgan bo'lsin.
    let courseId: string | null = input.courseId ?? null;
    let lessonId: string | null = input.lessonId ?? null;
    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, courseId: true },
      });
      if (!lesson) throw new BadRequestException('Dars topilmadi');
      if (courseId && courseId !== lesson.courseId) {
        throw new BadRequestException('Dars ko‘rsatilgan kursga tegishli emas');
      }
      courseId = lesson.courseId;
    }
    if (courseId) {
      const link = await this.prisma.courseGroup.findUnique({
        where: { courseId_groupId: { courseId, groupId: input.groupId } },
        select: { courseId: true },
      });
      if (!link) {
        throw new BadRequestException('Kurs bu guruhga biriktirilmagan');
      }
    }

    // F4: TIMED tekshiruvlar
    if (input.kind === 'TIMED') {
      if (!input.endsAt || !input.timeLimitMinutes) {
        throw new BadRequestException(
          'TIMED turi uchun endsAt va timeLimitMinutes majburiy',
        );
      }
      if (input.startsAt && input.endsAt && input.startsAt.getTime() >= input.endsAt.getTime()) {
        throw new BadRequestException('startsAt endsAt dan oldin bo‘lishi kerak');
      }
    }
    // F4: QUESTIONNAIRE — quizId mavjudligi tekshirilsin
    if (input.kind === 'QUESTIONNAIRE' && input.quizId) {
      const quiz = await this.prisma.quiz.findUnique({ where: { id: input.quizId }, select: { id: true } });
      if (!quiz) throw new BadRequestException('Test topilmadi');
    }

    const row = await this.prisma.assignment.create({
      data: {
        id: uuidv7(),
        groupId: input.groupId,
        courseId,
        lessonId,
        moduleId: input.moduleId ?? null,
        createdById: actor.id,
        kind: input.kind ?? 'TASK',
        titleUz: input.titleUz.trim(),
        descriptionUz: input.descriptionUz?.trim() ?? null,
        dueAt: input.dueAt ?? null,
        maxScore: input.maxScore ?? 100,
        allowLate: input.allowLate ?? false,
        latePenaltyPercent: input.latePenaltyPercent ?? 0,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        timeLimitMinutes: input.timeLimitMinutes ?? null,
        quizId: input.quizId ?? null,
      },
      select: ASSIGNMENT_SELECT,
    });

    const members = await this.prisma.groupMember.findMany({
      where: { groupId: input.groupId },
      select: { studentId: true },
    });
    if (members.length > 0) {
      await this.notifications.notifyUsers(
        members.map((m) => m.studentId),
        {
          type: 'assignment.created',
          titleUz: 'Yangi topshiriq',
          bodyUz: `Guruhingizga yangi topshiriq qo‘shildi: ${row.titleUz}`,
          data: { assignmentId: row.id, groupId: row.groupId },
        },
      );
    }

    return toAssignmentDto(row);
  }

  async updateAssignment(id: string, input: UpdateAssignmentInput, actor: Actor): Promise<AssignmentDto> {
    const existing = await this.prisma.assignment.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        titleUz: true,
        descriptionUz: true,
        dueAt: true,
        maxScore: true,
        groupId: true,
        courseId: true,
        lessonId: true,
        group: { select: { teacherId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Topshiriq topilmadi');
    if (!this.isSuperAdmin(actor) && existing.createdById !== actor.id && existing.group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu topshiriqni tahrirlash huquqingiz yo‘q');
    }

    // L7(b): dueAt o'tgan sanaga qo'yish taqiqlangan (hatto tahrirda ham).
    if (input.dueAt !== undefined && input.dueAt && input.dueAt.getTime() < Date.now()) {
      throw new BadRequestException('Muddat o‘tgan sanaga o‘zgartirilishi mumkin emas');
    }

    // L7(a): maxScore pasaytirilsa va baholangan topshiriqlarda score > new maxScore bo'lsa — 409.
    if (input.maxScore !== undefined && input.maxScore < existing.maxScore) {
      const highest = await this.prisma.assignmentSubmission.aggregate({
        where: { assignmentId: id, score: { not: null } },
        _max: { score: true },
      });
      if ((highest._max.score ?? 0) > input.maxScore) {
        throw new ConflictException(
          `Baholangan ballar bor (eng yuqori ${highest._max.score}). maxScore'ni ${highest._max.score} dan past qilib bo‘lmaydi`,
        );
      }
    }

    // L5: lesson/course consistency tahrirda ham tekshiriladi
    let courseId = existing.courseId;
    let lessonId = existing.lessonId;
    if (input.lessonId !== undefined) {
      lessonId = input.lessonId ?? null;
    }
    if (input.courseId !== undefined) {
      courseId = input.courseId ?? null;
    }
    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true },
      });
      if (!lesson) throw new BadRequestException('Dars topilmadi');
      if (courseId && courseId !== lesson.courseId) {
        throw new BadRequestException('Dars ko‘rsatilgan kursga tegishli emas');
      }
      courseId = lesson.courseId;
    }
    if (courseId) {
      const link = await this.prisma.courseGroup.findUnique({
        where: { courseId_groupId: { courseId, groupId: existing.groupId } },
        select: { courseId: true },
      });
      if (!link) throw new BadRequestException('Kurs bu guruhga biriktirilmagan');
    }

    const row = await this.prisma.assignment.update({
      where: { id },
      data: {
        ...(input.titleUz !== undefined ? { titleUz: input.titleUz.trim() } : {}),
        ...(input.descriptionUz !== undefined
          ? { descriptionUz: input.descriptionUz?.trim() ?? null }
          : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ?? null } : {}),
        ...(input.maxScore !== undefined ? { maxScore: input.maxScore } : {}),
        ...(input.courseId !== undefined || input.lessonId !== undefined ? { courseId, lessonId } : {}),
      },
      select: ASSIGNMENT_SELECT,
    });

    // L7(c): muddat, maxScore yoki tavsif o'zgarsa — guruh talabalariga bildirishnoma
    const notableChange =
      (input.dueAt !== undefined && (input.dueAt?.getTime() ?? null) !== (existing.dueAt?.getTime() ?? null)) ||
      (input.maxScore !== undefined && input.maxScore !== existing.maxScore) ||
      (input.descriptionUz !== undefined && (input.descriptionUz ?? null) !== existing.descriptionUz) ||
      (input.titleUz !== undefined && input.titleUz !== existing.titleUz);
    if (notableChange) {
      const members = await this.prisma.groupMember.findMany({
        where: { groupId: existing.groupId },
        select: { studentId: true },
      });
      if (members.length > 0) {
        await this.notifications.notifyUsers(
          members.map((m) => m.studentId),
          {
            type: 'assignment.updated',
            titleUz: 'Topshiriq yangilandi',
            bodyUz: `"${row.titleUz}" topshirig‘i ma'lumotlari o‘zgardi. Qayta ko‘rib chiqing.`,
            data: { assignmentId: row.id, groupId: row.groupId },
          },
        );
      }
    }

    return toAssignmentDto(row);
  }

  async removeAssignment(id: string, actor: Actor): Promise<void> {
    const existing = await this.prisma.assignment.findUnique({
      where: { id },
      select: { createdById: true, group: { select: { teacherId: true } } },
    });
    if (!existing) throw new NotFoundException('Topshiriq topilmadi');
    if (!this.isSuperAdmin(actor) && existing.createdById !== actor.id && existing.group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu topshiriqni o‘chirish huquqingiz yo‘q');
    }
    await this.prisma.assignment.delete({ where: { id } });
  }

  /**
   * F4 TIMED: talaba urinishni boshlaydi. Server attemptStartedAt va
   * attemptDeadline = min(now + timeLimit, endsAt) ni yozadi. Sahifa
   * yangilansa shu qiymatlar qaytariladi (taymer serverdan tiklanadi).
   */
  async startTimedAttempt(assignmentId: string, actor: Actor): Promise<AssignmentSubmissionDto> {
    if (!this.isStudent(actor)) throw new ForbiddenException('Faqat talaba');
    const a = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        kind: true,
        startsAt: true,
        endsAt: true,
        timeLimitMinutes: true,
        groupId: true,
        group: { select: { isActive: true } },
      },
    });
    if (!a) throw new NotFoundException('Topshiriq topilmadi');
    if (!a.group.isActive) throw new ConflictException('Guruh nofaol');
    if (a.kind !== 'TIMED') throw new BadRequestException('Faqat TIMED topshiriq uchun');
    if (!a.endsAt || !a.timeLimitMinutes) {
      throw new BadRequestException('TIMED sozlamalari to‘liq emas');
    }
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId: actor.id },
      select: { groupId: true },
    });
    if (!member || member.groupId !== a.groupId) {
      throw new ForbiddenException('Bu topshiriq sizning guruhingizga tegishli emas');
    }
    const now = new Date();
    if (a.startsAt && a.startsAt.getTime() > now.getTime()) {
      throw new BadRequestException(`Boshlanish: ${a.startsAt.toISOString()}`);
    }
    if (a.endsAt.getTime() < now.getTime()) {
      throw new BadRequestException('Test oynasi yopildi');
    }
    // Alohida uzaytirish
    const acc = await this.prisma.assignmentAccommodation.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
    });
    const extra = acc?.extraMinutes ?? 0;
    const limitMs = (a.timeLimitMinutes + extra) * 60_000;
    const deadline = new Date(Math.min(now.getTime() + limitMs, a.endsAt.getTime()));

    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
    });
    if (existing && existing.attemptDeadline && existing.attemptDeadline.getTime() > now.getTime()) {
      // Faol urinish bor — xuddi shu qaytariladi (sahifa yangilansa taymer tiklanadi)
      return toSubmissionDto(await this.prisma.assignmentSubmission.findUnique({
        where: { id: existing.id },
        select: SUBMISSION_SELECT,
      }) as SubmissionRow);
    }
    if (existing && existing.status === 'GRADED') {
      throw new BadRequestException('Bu topshiriq baholab bo‘lingan');
    }

    const row = existing
      ? await this.prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            attemptStartedAt: now,
            attemptDeadline: deadline,
            status: AssignmentSubmissionStatus.SUBMITTED,
          },
          select: SUBMISSION_SELECT,
        })
      : await this.prisma.assignmentSubmission.create({
          data: {
            id: uuidv7(),
            assignmentId,
            studentId: actor.id,
            textUz: null,
            attempt: 1,
            attemptStartedAt: now,
            attemptDeadline: deadline,
          },
          select: SUBMISSION_SELECT,
        });
    return toSubmissionDto(row);
  }

  /**
   * F4 TIMED/TASK: o'qituvchi alohida talabaga vaqt uzaytiradi.
   */
  async upsertAccommodation(
    assignmentId: string,
    studentId: string,
    input: { extraMinutes?: number; newDueAt?: Date },
    actor: Actor,
  ) {
    const a = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { createdById: true, group: { select: { teacherId: true } } },
    });
    if (!a) throw new NotFoundException('Topshiriq topilmadi');
    if (!this.isSuperAdmin(actor) && a.createdById !== actor.id && a.group.teacherId !== actor.id) {
      throw new ForbiddenException("Faqat o'z guruhingiz uchun");
    }
    const existing = await this.prisma.assignmentAccommodation.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
    const row = existing
      ? await this.prisma.assignmentAccommodation.update({
          where: { id: existing.id },
          data: { extraMinutes: input.extraMinutes ?? null, newDueAt: input.newDueAt ?? null },
        })
      : await this.prisma.assignmentAccommodation.create({
          data: {
            id: uuidv7(),
            assignmentId,
            studentId,
            extraMinutes: input.extraMinutes ?? null,
            newDueAt: input.newDueAt ?? null,
          },
        });
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      studentId: row.studentId,
      extraMinutes: row.extraMinutes,
      newDueAt: row.newDueAt?.toISOString() ?? null,
    };
  }

  async submitAssignment(
    assignmentId: string,
    input: SubmitAssignmentInput,
    actor: Actor,
  ): Promise<AssignmentSubmissionDto> {
    if (!this.isStudent(actor)) {
      throw new ForbiddenException('Faqat talaba topshiriq topshira oladi');
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        groupId: true,
        dueAt: true,
        titleUz: true,
        createdById: true,
        kind: true,
        allowLate: true,
        endsAt: true,
        group: { select: { teacherId: true, isActive: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi');

    // L9: nofaol guruh — talaba yangi javob topshira olmaydi (arxiv-faqat)
    if (!assignment.group.isActive) {
      throw new ConflictException('Guruh nofaol — topshirishga ruxsat yo‘q');
    }

    const now = Date.now();
    // L7: dueAt o'tgan — allowLate=true bo'lsa qabul qilinadi, lekin isLate=true belgilanadi
    let isLate = false;
    if (assignment.dueAt && assignment.dueAt.getTime() < now) {
      if (!assignment.allowLate) {
        throw new BadRequestException('Topshiriq muddati o‘tdi');
      }
      isLate = true;
    }
    // F4 TIMED: endsAt o'tgan — qabul qilinmaydi (qattiq)
    if (assignment.kind === 'TIMED' && assignment.endsAt && assignment.endsAt.getTime() < now) {
      throw new BadRequestException('Test oynasi yopildi');
    }

    // Student o'z guruhidagi topshiriqdagina
    const membership = await this.prisma.groupMember.findUnique({
      where: { studentId: actor.id },
      select: { groupId: true },
    });
    if (!membership || membership.groupId !== assignment.groupId) {
      throw new ForbiddenException('Bu topshiriq sizning guruhingizga tegishli emas');
    }

    const text = input.textUz?.trim();
    if (!text) throw new BadRequestException('Matn kiritilmagan (fayl yuklash alohida endpointda)');

    // L8: holatlar:
    //  - SUBMITTED  → qayta tahrir ruxsat etiladi (ustoz hali baholamagan)
    //  - RETURNED   → qayta topshirish RUXSAT etiladi (attempt +1, oldingi revision'ga saqlanadi)
    //  - GRADED     → rad etiladi (ustoz baholab bo'lgan, qayta ochish uchun UI alohida)
    //  - PENDING_REVIEW → rad (ustoz tomonidan qayta ko'rib chiqilmoqda)
    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
    });
    if (existing && existing.status === AssignmentSubmissionStatus.GRADED) {
      throw new BadRequestException('Topshiriq baholangandan keyin qayta topshirib bo‘lmaydi');
    }
    if (existing && existing.status === AssignmentSubmissionStatus.PENDING_REVIEW) {
      throw new BadRequestException("Topshiriq o'qituvchi ko'rib chiqishida");
    }

    // F4 TIMED: faol urinish bor bo'lsa deadline tekshirilsin
    if (assignment.kind === 'TIMED') {
      const existingAttempt = await this.prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
        select: { attemptDeadline: true },
      });
      if (!existingAttempt || !existingAttempt.attemptDeadline) {
        throw new BadRequestException(
          'TIMED: avval POST /assignments/:id/start chaqirib urinishni boshlang',
        );
      }
      if (existingAttempt.attemptDeadline.getTime() < now) {
        throw new BadRequestException('TIMED: urinish vaqti tugadi');
      }
    }

    let row;
    if (!existing) {
      row = await this.prisma.assignmentSubmission.create({
        data: {
          id: uuidv7(),
          assignmentId,
          studentId: actor.id,
          textUz: text,
          attempt: 1,
          isLate,
        },
        select: SUBMISSION_SELECT,
      });
    } else if (existing.status === AssignmentSubmissionStatus.RETURNED) {
      // Oldingi javobni revision'ga saqlaymiz
      await this.prisma.assignmentSubmissionRevision.create({
        data: {
          id: uuidv7(),
          submissionId: existing.id,
          attempt: existing.attempt,
          textUz: existing.textUz,
          fileKey: existing.fileKey,
          fileName: existing.fileName,
          submittedAt: existing.submittedAt,
          score: existing.score,
          feedbackUz: existing.feedbackUz,
          gradedById: existing.gradedById,
          gradedAt: existing.gradedAt,
          status: existing.status,
        },
      });
      row = await this.prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: {
          textUz: text,
          submittedAt: new Date(),
          status: AssignmentSubmissionStatus.SUBMITTED,
          attempt: existing.attempt + 1,
          score: null,
          feedbackUz: null,
          gradedAt: null,
          gradedById: null,
          isLate,
        },
        select: SUBMISSION_SELECT,
      });
    } else {
      // SUBMITTED — tahrir
      row = await this.prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: {
          textUz: text,
          submittedAt: new Date(),
          status: AssignmentSubmissionStatus.SUBMITTED,
          isLate,
        },
        select: SUBMISSION_SELECT,
      });
    }

    const teacherId = assignment.group.teacherId;
    const targets = Array.from(
      new Set([teacherId, assignment.createdById].filter(Boolean) as string[]),
    );
    if (targets.length > 0) {
      await this.notifications.notifyUsers(targets, {
        type: 'assignment.submitted',
        titleUz: 'Topshiriq qabul qilindi',
        bodyUz: `Talaba "${assignment.titleUz}" topshirig‘ini topshirdi`,
        data: { assignmentId, submissionId: row.id, studentId: actor.id },
      });
    }

    return toSubmissionDto(row);
  }

  async gradeSubmission(
    submissionId: string,
    input: GradeAssignmentInput,
    actor: Actor,
  ): Promise<AssignmentSubmissionDto> {
    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        assignment: {
          select: {
            id: true,
            titleUz: true,
            maxScore: true,
            createdById: true,
            group: { select: { teacherId: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Topshiriq topilmadi');
    const a = existing.assignment;
    if (
      !this.isSuperAdmin(actor) &&
      a.createdById !== actor.id &&
      a.group.teacherId !== actor.id
    ) {
      throw new ForbiddenException('Bu topshiriqni baholash huquqingiz yo‘q');
    }

    if (input.score > a.maxScore) {
      throw new BadRequestException(
        `Ball maksimaldan oshmasligi kerak (maxScore=${a.maxScore})`,
      );
    }

    const row = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: input.score,
        feedbackUz: input.feedbackUz?.trim() ?? null,
        gradedAt: new Date(),
        gradedById: actor.id,
        status: input.status,
      },
      select: SUBMISSION_SELECT,
    });

    await this.notifications.notifyUsers([existing.studentId], {
      type: 'assignment.graded',
      titleUz: 'Topshiriq baholandi',
      bodyUz: `"${a.titleUz}" topshirig‘i baholandi: ${input.score}/${a.maxScore}`,
      data: { assignmentId: a.id, submissionId, score: input.score, maxScore: a.maxScore },
    });

    return toSubmissionDto(row);
  }

  /**
   * L8: o'qituvchi baholangan topshiriqni "qayta ochadi" — status RETURNED
   * bo'ladi, talaba qayta topshira oladi (attempt +1 submit paytida).
   */
  async reopenSubmission(submissionId: string, feedback: string | undefined, actor: Actor): Promise<AssignmentSubmissionDto> {
    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        status: true,
        assignment: {
          select: {
            id: true,
            titleUz: true,
            createdById: true,
            group: { select: { teacherId: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Topshiriq topilmadi');
    const a = existing.assignment;
    if (!this.isSuperAdmin(actor) && a.createdById !== actor.id && a.group.teacherId !== actor.id) {
      throw new ForbiddenException("Bu topshiriqni qayta ochish huquqingiz yo'q");
    }
    const row = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: AssignmentSubmissionStatus.RETURNED,
        feedbackUz: feedback?.trim() ?? null,
      },
      select: SUBMISSION_SELECT,
    });
    await this.notifications.notifyUsers([existing.studentId], {
      type: 'assignment.reopened',
      titleUz: 'Topshiriq qaytarildi',
      bodyUz: `"${a.titleUz}" topshirig‘i qayta ko‘rib chiqish uchun qaytarildi`,
      data: { assignmentId: a.id, submissionId },
    });
    return toSubmissionDto(row);
  }

  async listSubmissions(
    assignmentId: string,
    actor: Actor,
  ): Promise<AssignmentSubmissionWithStudentDto[]> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { createdById: true, group: { select: { teacherId: true } } },
    });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi');
    if (
      !this.isSuperAdmin(actor) &&
      assignment.createdById !== actor.id &&
      assignment.group.teacherId !== actor.id
    ) {
      throw new ForbiddenException('Ko‘rish huquqingiz yo‘q');
    }

    const rows = await this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      select: {
        ...SUBMISSION_SELECT,
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return rows.map((r) => ({ ...toSubmissionDto(r), student: r.student }));
  }

  async mySubmission(assignmentId: string, actor: Actor): Promise<AssignmentSubmissionDto | null> {
    const row = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
      select: SUBMISSION_SELECT,
    });
    return row ? toSubmissionDto(row) : null;
  }

  // -------------------------------------------------------------
  // F5 (2.C): Study tracking — heartbeat, timeline, aggregates
  // -------------------------------------------------------------

  /**
   * Dars sahifasi faol vaqtda frontend har ~30s da chaqiradi. Server har
   * chaqiruvda ko'pi bilan 60s qo'shadi — soxta vaqt yuborilsa limitlanadi.
   * Studentni darsga kirish huquqi tekshiriladi (progress yozilgan dars bilan
   * bir xil mantiq).
   */
  async heartbeat(
    lessonId: string,
    activeSeconds: number,
    position: number | undefined,
    actor: Actor,
  ) {
    if (!this.isStudent(actor)) throw new ForbiddenException('Faqat talaba');
    if (!Number.isFinite(activeSeconds) || activeSeconds < 0) {
      throw new BadRequestException('activeSeconds >= 0 bo‘lishi kerak');
    }
    const bounded = Math.min(60, Math.max(0, Math.floor(activeSeconds)));

    // Dars huquqini tekshirish (updateProgress bilan bir xil)
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, course: { select: { isPublished: true } } },
    });
    if (!lesson || !lesson.course.isPublished) throw new NotFoundException('Dars topilmadi');
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId: actor.id },
      select: { groupId: true, group: { select: { isActive: true } } },
    });
    if (!member || !member.group.isActive) throw new NotFoundException('Dars topilmadi');
    const link = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId: lesson.courseId, groupId: member.groupId } },
      select: { courseId: true },
    });
    if (!link) throw new NotFoundException('Dars topilmadi');

    const now = new Date();

    // LessonProgress yangilash (viewCount, timeSpentSec, lastPosition)
    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: actor.id, lessonId } },
      create: {
        id: uuidv7(),
        studentId: actor.id,
        lessonId,
        completedAt: null,
        firstViewedAt: now,
        lastViewedAt: now,
        viewCount: 1,
        timeSpentSec: bounded,
        lastPosition: position ?? 0,
      },
      update: {
        lastViewedAt: now,
        timeSpentSec: { increment: bounded },
        ...(position !== undefined ? { lastPosition: position } : {}),
      },
    });

    // StudyEvent (heartbeat)
    await this.prisma.studyEvent.create({
      data: {
        id: uuidv7(),
        studentId: actor.id,
        type: 'LESSON_HEARTBEAT',
        refId: lessonId,
        meta: { activeSeconds: bounded, position: position ?? null } as Prisma.InputJsonValue,
        at: now,
      },
    });

    return { ok: true, addedSeconds: bounded };
  }

  /**
   * Talabaning umumiy ko'rinishi — statistika + so'nggi faollik + xavf belgisi.
   * L15/L16: lastActivityAt endi lastViewedAt'ni ham hisobga oladi.
   */
  async studentOverview(studentId: string, actor: Actor) {
    const stats = await this.studentStats(studentId, actor);
    const lastView = await this.prisma.lessonProgress.aggregate({
      where: { studentId },
      _max: { lastViewedAt: true },
    });
    const totalTime = await this.prisma.lessonProgress.aggregate({
      where: { studentId },
      _sum: { timeSpentSec: true },
    });
    // So'nggi 7 kun faollik
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    const events = await this.prisma.studyEvent.groupBy({
      by: ['type'],
      where: { studentId, at: { gte: sevenDaysAgo } },
      _count: true,
    });
    const activityCounts: Record<string, number> = {};
    for (const e of events) {
      activityCounts[e.type] = e._count;
    }
    const combinedLastActivity = Math.max(
      lastView._max.lastViewedAt?.getTime() ?? 0,
      stats.lastActivityAt ? new Date(stats.lastActivityAt).getTime() : 0,
    );
    const risks: string[] = [];
    if (combinedLastActivity && Date.now() - combinedLastActivity > 7 * 86_400_000) {
      risks.push('inactive_7d');
    }
    if (
      stats.assignmentsAverageScore !== null &&
      stats.assignmentsAverageScore < 50
    ) {
      risks.push('low_avg_score');
    }
    const now = Date.now();
    const overdueCount = await this.prisma.assignment.count({
      where: {
        group: { members: { some: { studentId } } },
        dueAt: { lt: new Date(now) },
        submissions: { none: { studentId } },
      },
    });
    if (overdueCount >= 2) risks.push('overdue_2plus');

    return {
      ...stats,
      totalStudyTimeSec: totalTime._sum.timeSpentSec ?? 0,
      lastActivityAt: combinedLastActivity ? new Date(combinedLastActivity).toISOString() : null,
      weeklyActivity: activityCounts,
      overdueAssignments: overdueCount,
      risks,
    };
  }

  async studentTimeline(studentId: string, actor: Actor, from?: Date, to?: Date) {
    // Access tekshiruv studentStats bilan bir xil (yangi ichida chaqirmaymiz, tekshirilsin)
    if (this.isStudent(actor) && actor.id !== studentId) {
      throw new ForbiddenException('Boshqa talaba timeline’ini ko‘ra olmaysiz');
    }
    if (this.isTeacher(actor)) {
      const member = await this.prisma.groupMember.findUnique({
        where: { studentId },
        include: { group: { select: { teacherId: true } } },
      });
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { createdById: true },
      });
      const owns =
        student?.createdById === actor.id || member?.group.teacherId === actor.id;
      if (!owns) throw new ForbiddenException('Bu talaba sizga tegishli emas');
    }
    const rows = await this.prisma.studyEvent.findMany({
      where: {
        studentId,
        ...(from ? { at: { gte: from } } : {}),
        ...(to ? { at: { lte: to } } : {}),
      },
      orderBy: { at: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      refId: r.refId,
      meta: r.meta,
      at: r.at.toISOString(),
    }));
  }

  /**
   * L15: guruh statistikasi — bitta agregat so'rov; `pendingSubmissions`
   * faqat shu guruh topshiriqlari bo'yicha; talabalar kesimidagi jadval.
   */
  async groupStudents(groupId: string, actor: Actor) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { teacherId: true },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruh statistikasini ko‘ra olmaysiz');
    }
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const result = [];
    for (const m of members) {
      const stats = await this.studentOverview(m.studentId, actor);
      result.push({
        student: m.student,
        progressPercent: stats.progressPercent,
        quizzesAverageScore: stats.quizzesAverageScore,
        assignmentsAverageScore: stats.assignmentsAverageScore,
        lastActivityAt: stats.lastActivityAt,
        totalStudyTimeSec: stats.totalStudyTimeSec,
        overdueAssignments: stats.overdueAssignments,
        risks: stats.risks,
      });
    }
    return result;
  }

  // -------------------------------------------------------------
  // LessonProgress
  // -------------------------------------------------------------

  async updateProgress(lessonId: string, completed: boolean, actor: Actor) {
    if (!this.isStudent(actor)) {
      throw new ForbiddenException('Faqat talaba darsni belgilay oladi');
    }
    // L2: faqat talabaning FAOL guruhiga biriktirilgan va PUBLISHED kurs
    // darsiga progress yoziladi. Aks holda 404 (probe-safe).
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, course: { select: { isPublished: true } } },
    });
    if (!lesson || !lesson.course.isPublished) {
      throw new NotFoundException('Dars topilmadi');
    }
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId: actor.id },
      select: { groupId: true, group: { select: { isActive: true } } },
    });
    if (!member || !member.group.isActive) throw new NotFoundException('Dars topilmadi');
    const link = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId: lesson.courseId, groupId: member.groupId } },
      select: { courseId: true },
    });
    if (!link) throw new NotFoundException('Dars topilmadi');

    const now = new Date();
    const row = await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: actor.id, lessonId } },
      create: {
        id: uuidv7(),
        studentId: actor.id,
        lessonId,
        completedAt: completed ? now : null,
        lastViewedAt: now,
      },
      update: {
        lastViewedAt: now,
        completedAt: completed ? now : null,
      },
    });
    return {
      id: row.id,
      studentId: row.studentId,
      lessonId: row.lessonId,
      completedAt: row.completedAt?.toISOString() ?? null,
      lastViewedAt: row.lastViewedAt.toISOString(),
    };
  }

  async myProgress(actor: Actor) {
    if (!this.isStudent(actor)) return [];
    const rows = await this.prisma.lessonProgress.findMany({
      where: { studentId: actor.id },
      orderBy: { lastViewedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      lessonId: r.lessonId,
      completedAt: r.completedAt?.toISOString() ?? null,
      lastViewedAt: r.lastViewedAt.toISOString(),
    }));
  }

  // -------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------

  async studentStats(studentId: string, actor: Actor): Promise<StudentStatsDto> {
    // Access check: SA, TEACHER (o'ziniki yaratgan yoki guruhdagilarini), yoki o'zini
    if (this.isStudent(actor) && actor.id !== studentId) {
      throw new ForbiddenException('Boshqa talaba natijalarini ko‘ra olmaysiz');
    }
    if (this.isTeacher(actor)) {
      const member = await this.prisma.groupMember.findUnique({
        where: { studentId },
        include: { group: { select: { teacherId: true } } },
      });
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { createdById: true },
      });
      const ownsStudent = student?.createdById === actor.id;
      const ownsGroup = member?.group.teacherId === actor.id;
      if (!ownsStudent && !ownsGroup) {
        throw new ForbiddenException('Bu talaba sizga tegishli emas');
      }
    }

    const member = await this.prisma.groupMember.findUnique({
      where: { studentId },
      select: { groupId: true },
    });

    // Darslar — talaba guruhida biriktirilgan va PUBLISHED kurslar bo'yicha
    let lessonsTotal = 0;
    let visibleLessonIds: string[] = [];
    if (member) {
      const courseGroups = await this.prisma.courseGroup.findMany({
        where: { groupId: member.groupId, course: { isPublished: true } },
        select: { courseId: true },
      });
      const courseIds = courseGroups.map((c) => c.courseId);
      if (courseIds.length > 0) {
        const lessons = await this.prisma.lesson.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true },
        });
        visibleLessonIds = lessons.map((l) => l.id);
        lessonsTotal = visibleLessonIds.length;
      }
    }
    // L2: faqat ko'rinadigan darslar progressi hisobga olinadi, aks holda
    // "yashirin" progress 100%+ chiqishi mumkin.
    const lessonsCompleted =
      visibleLessonIds.length === 0
        ? 0
        : await this.prisma.lessonProgress.count({
            where: {
              studentId,
              completedAt: { not: null },
              lessonId: { in: visibleLessonIds },
            },
          });

    const progressPercent =
      lessonsTotal === 0
        ? 0
        : Math.min(100, Math.round((lessonsCompleted / lessonsTotal) * 100));

    // L13: noyob testlar bo'yicha (bitta testni 2 marta topshirgan talaba
    // "1" ko'rinadi); eng oxirgi urinish o'rtacha ballda hisobga olinadi.
    const allQuizSubs = await this.prisma.quizSubmission.findMany({
      where: { userId: studentId, status: 'SUBMITTED' },
      select: { quizId: true, scorePercent: true, passed: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });
    // Noyob quizId -> eng oxirgi urinish
    const latestByQuiz = new Map<string, (typeof allQuizSubs)[number]>();
    for (const q of allQuizSubs) {
      if (!latestByQuiz.has(q.quizId)) latestByQuiz.set(q.quizId, q);
    }
    const quizSubs = Array.from(latestByQuiz.values());
    const quizzesTaken = quizSubs.length;
    const quizzesPassed = quizSubs.filter((q) => q.passed).length;
    const scored = quizSubs.filter((q) => q.scorePercent !== null);
    const quizzesAverageScore =
      scored.length === 0 ? null : Math.round(scored.reduce((s, q) => s + (q.scorePercent ?? 0), 0) / scored.length);

    // L6: baho o'rtachasini FOIZ bilan hisoblash (score/maxScore*100), xom
    // ball emas. Agar maxScore=0 (nazariy chekka) bo'lsa 0 deb olinadi.
    const asSubs = await this.prisma.assignmentSubmission.findMany({
      where: { studentId },
      select: {
        score: true,
        status: true,
        submittedAt: true,
        gradedAt: true,
        assignment: { select: { maxScore: true } },
      },
    });
    const assignmentsSubmitted = asSubs.length;
    const graded = asSubs.filter((a) => a.score !== null);
    const assignmentsGraded = graded.length;
    const assignmentsAverageScore =
      graded.length === 0
        ? null
        : Math.round(
            graded.reduce((s, g) => {
              const max = g.assignment?.maxScore ?? 100;
              return s + (max > 0 ? ((g.score ?? 0) / max) * 100 : 0);
            }, 0) / graded.length,
          );

    // L16: dars ko'rishlar (lastViewedAt) ham hisobga olinadi
    const lastView = await this.prisma.lessonProgress.aggregate({
      where: { studentId },
      _max: { lastViewedAt: true },
    });
    const latestActivity = [
      ...quizSubs.map((q) => q.submittedAt?.getTime() ?? 0),
      ...asSubs.map((a) => (a.gradedAt ?? a.submittedAt)?.getTime() ?? 0),
      lastView._max.lastViewedAt?.getTime() ?? 0,
    ].reduce((m, t) => Math.max(m, t), 0);

    return {
      studentId,
      lessonsTotal,
      lessonsCompleted,
      progressPercent,
      quizzesTaken,
      quizzesPassed,
      quizzesAverageScore,
      assignmentsSubmitted,
      assignmentsGraded,
      assignmentsAverageScore,
      lastActivityAt: latestActivity > 0 ? new Date(latestActivity).toISOString() : null,
    };
  }

  async groupStats(groupId: string, actor: Actor): Promise<GroupStatsDto> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { teacherId: true },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruh statistikasini ko‘ra olmaysiz');
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { studentId: true },
    });
    const studentIds = members.map((m) => m.studentId);

    const studentStatsList: StudentStatsDto[] = [];
    for (const sid of studentIds) {
      studentStatsList.push(await this.studentStats(sid, { id: actor.id, roles: actor.roles }));
    }

    const avgProgressPercent =
      studentIds.length === 0
        ? 0
        : Math.round(studentStatsList.reduce((s, x) => s + x.progressPercent, 0) / studentIds.length);

    const scores = studentStatsList
      .map((s) => s.quizzesAverageScore)
      .filter((s): s is number => s !== null);
    const avgQuizScore =
      scores.length === 0 ? null : Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);

    // L15: faqat SHU guruh topshiriqlari bo'yicha hisoblanadi
    const pendingSubmissions = await this.prisma.assignmentSubmission.count({
      where: {
        studentId: { in: studentIds },
        status: AssignmentSubmissionStatus.SUBMITTED,
        assignment: { groupId },
      },
    });

    return {
      groupId,
      studentCount: studentIds.length,
      avgProgressPercent,
      avgQuizScore,
      pendingSubmissions,
    };
  }

  async myStats(actor: Actor): Promise<StudentStatsDto | null> {
    if (!this.isStudent(actor)) return null;
    return this.studentStats(actor.id, actor);
  }
}
