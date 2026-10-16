import {
  BadRequestException,
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

export interface Actor {
  id: string;
  roles: string[];
}

const ASSIGNMENT_SELECT = {
  id: true,
  courseId: true,
  lessonId: true,
  groupId: true,
  createdById: true,
  titleUz: true,
  descriptionUz: true,
  dueAt: true,
  maxScore: true,
  attachmentKey: true,
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
    groupId: r.groupId,
    createdById: r.createdById,
    titleUz: r.titleUz,
    descriptionUz: r.descriptionUz,
    dueAt: r.dueAt?.toISOString() ?? null,
    maxScore: r.maxScore,
    attachmentKey: r.attachmentKey,
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
  };
}

@Injectable()
export class LmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
      // Student faqat o'z guruhidagi topshiriqlar
      const membership = await this.prisma.groupMember.findUnique({
        where: { studentId: actor.id },
        select: { groupId: true },
      });
      if (!membership) return { data: [], meta: { page, perPage, total: 0, totalPages: 1 } };
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
      select: { teacherId: true },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Faqat o‘z guruhlaringizga topshiriq yaratishingiz mumkin');
    }

    const row = await this.prisma.assignment.create({
      data: {
        id: uuidv7(),
        groupId: input.groupId,
        courseId: input.courseId ?? null,
        lessonId: input.lessonId ?? null,
        createdById: actor.id,
        titleUz: input.titleUz.trim(),
        descriptionUz: input.descriptionUz?.trim() ?? null,
        dueAt: input.dueAt ?? null,
        maxScore: input.maxScore ?? 100,
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
      select: { createdById: true, group: { select: { teacherId: true } } },
    });
    if (!existing) throw new NotFoundException('Topshiriq topilmadi');
    if (!this.isSuperAdmin(actor) && existing.createdById !== actor.id && existing.group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu topshiriqni tahrirlash huquqingiz yo‘q');
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
        ...(input.courseId !== undefined ? { courseId: input.courseId ?? null } : {}),
        ...(input.lessonId !== undefined ? { lessonId: input.lessonId ?? null } : {}),
      },
      select: ASSIGNMENT_SELECT,
    });
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
        group: { select: { teacherId: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi');

    // Muddati o'tgan bo'lsa — topshirish mumkin emas
    if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
      throw new BadRequestException('Topshiriq muddati o‘tdi');
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

    // Mavjud bo'lsa — tahrir ruxsat etiladi FAQAT status=SUBMITTED bo'lsa.
    // GRADED/RETURNED bo'lsa — qayta topshirishga ruxsat yo'q (ustoz baholab bo'lgan).
    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
    });
    if (existing && existing.status !== AssignmentSubmissionStatus.SUBMITTED) {
      throw new BadRequestException(
        'Topshiriq baholangandan keyin qayta topshirib bo‘lmaydi',
      );
    }

    const row = existing
      ? await this.prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            textUz: text,
            submittedAt: new Date(),
            status: AssignmentSubmissionStatus.SUBMITTED,
          },
          select: SUBMISSION_SELECT,
        })
      : await this.prisma.assignmentSubmission.create({
          data: {
            id: uuidv7(),
            assignmentId,
            studentId: actor.id,
            textUz: text,
          },
          select: SUBMISSION_SELECT,
        });

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
  // LessonProgress
  // -------------------------------------------------------------

  async updateProgress(lessonId: string, completed: boolean, actor: Actor) {
    if (!this.isStudent(actor)) {
      throw new ForbiddenException('Faqat talaba darsni belgilay oladi');
    }
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

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

    // Darslar — talaba guruhida biriktirilgan kurslar bo'yicha
    let lessonsTotal = 0;
    if (member) {
      const courseGroups = await this.prisma.courseGroup.findMany({
        where: { groupId: member.groupId },
        select: { courseId: true },
      });
      const courseIds = courseGroups.map((c) => c.courseId);
      if (courseIds.length > 0) {
        lessonsTotal = await this.prisma.lesson.count({
          where: { courseId: { in: courseIds } },
        });
      }
    }
    const lessonsCompleted = await this.prisma.lessonProgress.count({
      where: { studentId, completedAt: { not: null } },
    });

    const progressPercent =
      lessonsTotal === 0 ? 0 : Math.round((lessonsCompleted / lessonsTotal) * 100);

    const quizSubs = await this.prisma.quizSubmission.findMany({
      where: { userId: studentId, status: 'SUBMITTED' },
      select: { scorePercent: true, passed: true, submittedAt: true },
    });
    const quizzesTaken = quizSubs.length;
    const quizzesPassed = quizSubs.filter((q) => q.passed).length;
    const scored = quizSubs.filter((q) => q.scorePercent !== null);
    const quizzesAverageScore =
      scored.length === 0 ? null : Math.round(scored.reduce((s, q) => s + (q.scorePercent ?? 0), 0) / scored.length);

    const asSubs = await this.prisma.assignmentSubmission.findMany({
      where: { studentId },
      select: { score: true, status: true, submittedAt: true, gradedAt: true },
    });
    const assignmentsSubmitted = asSubs.length;
    const graded = asSubs.filter((a) => a.score !== null);
    const assignmentsGraded = graded.length;
    const assignmentsAverageScore =
      graded.length === 0 ? null : Math.round(graded.reduce((s, g) => s + (g.score ?? 0), 0) / graded.length);

    const latestActivity = [
      ...quizSubs.map((q) => q.submittedAt?.getTime() ?? 0),
      ...asSubs.map((a) => (a.gradedAt ?? a.submittedAt)?.getTime() ?? 0),
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

    const pendingSubmissions = await this.prisma.assignmentSubmission.count({
      where: {
        studentId: { in: studentIds },
        status: AssignmentSubmissionStatus.SUBMITTED,
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
