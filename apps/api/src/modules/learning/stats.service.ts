import { Injectable } from '@nestjs/common';
import type { GroupStatsDto, StudentStatsDto } from '@eco/shared';
import { z } from 'zod';

import { PrismaService } from '../../infra/prisma.service';
import { type Actor, isStudent } from '../auth/actor';
import { effectiveDueAt } from './deadline-policy';
import { LearningAccess } from './learning-access.service';

export const timelineQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;

const DAY = 86_400_000;
const avg = (xs: number[]) => (xs.length === 0 ? null : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length));
const latest = (...ts: Array<Date | null | undefined>) => Math.max(0, ...ts.map((t) => t?.getTime() ?? 0));

export interface StudentOverview extends StudentStatsDto {
  totalStudyTimeSec: number;
  weeklyActivity: Record<string, number>;
  overdueAssignments: number;
  risks: string[];
}

/**
 * Statistika talabaning JORIY guruhi kesimida: shu guruhga biriktirilgan
 * (nashr etilgan) darslar, testlar va topshiriqlar. Guruh bo'yicha hisob bitta
 * to'plam so'rovlar bilan — talabalar soniga qarab so'rov ko'paymaydi.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LearningAccess,
  ) {}

  /** Talaba bo'lmasa yoki guruhi yo'q bo'lsa — null. */
  async me(actor: Actor): Promise<StudentStatsDto | null> {
    if (!isStudent(actor)) return null;
    const member = await this.access.membership(actor.id);
    if (!member) return null;
    return (await this.studentStats([actor.id], member.groupId)).get(actor.id) ?? null;
  }

  async studentOverview(studentId: string, actor: Actor): Promise<StudentOverview> {
    await this.access.assertCanViewStudent(studentId, actor);
    const member = await this.access.membership(studentId);
    const overviews = await this.overviews([studentId], member?.groupId ?? null);
    return overviews.get(studentId)!;
  }

  async timeline(studentId: string, q: TimelineQuery, actor: Actor) {
    await this.access.assertCanViewStudent(studentId, actor);
    const rows = await this.prisma.studyEvent.findMany({
      where: { studentId, at: q.from || q.to ? { gte: q.from, lte: q.to } : undefined },
      orderBy: { at: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({ id: r.id, type: r.type, refId: r.refId, meta: r.meta, at: r.at.toISOString() }));
  }

  async group(groupId: string, actor: Actor): Promise<GroupStatsDto> {
    await this.access.managedGroup(groupId, actor);
    const ids = await this.memberIds(groupId);
    const [stats, pendingSubmissions] = await Promise.all([
      this.studentStats(ids, groupId),
      this.prisma.assignmentSubmission.count({
        where: { studentId: { in: ids }, status: 'SUBMITTED', assignment: { groupId } },
      }),
    ]);
    const list = [...stats.values()];
    return {
      groupId,
      studentCount: ids.length,
      avgProgressPercent: avg(list.map((s) => s.progressPercent)) ?? 0,
      avgQuizScore: avg(list.flatMap((s) => (s.quizzesAverageScore === null ? [] : [s.quizzesAverageScore]))),
      pendingSubmissions,
    };
  }

  async groupStudents(groupId: string, actor: Actor) {
    await this.access.managedGroup(groupId, actor);
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    const overviews = await this.overviews(members.map((m) => m.student.id), groupId);
    return members.map(({ student }) => {
      const o = overviews.get(student.id)!;
      return {
        student,
        progressPercent: o.progressPercent,
        quizzesAverageScore: o.quizzesAverageScore,
        assignmentsAverageScore: o.assignmentsAverageScore,
        lastActivityAt: o.lastActivityAt,
        totalStudyTimeSec: o.totalStudyTimeSec,
        overdueAssignments: o.overdueAssignments,
        risks: o.risks,
      };
    });
  }

  private async memberIds(groupId: string) {
    const rows = await this.prisma.groupMember.findMany({ where: { groupId }, select: { studentId: true } });
    return rows.map((r) => r.studentId);
  }

  /** Talabaga haqiqatan ko'rinadigan darslar (nashr etilgan kurs/modul/dars). */
  private async visibleLessonIds(groupId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        course: { isPublished: true, groups: { some: { groupId } } },
        isPublished: true,
        archivedAt: null,
        OR: [{ moduleId: null }, { module: { isPublished: true } }],
      },
      select: { id: true },
    });
    return lessons.map((l) => l.id);
  }

  private async studentStats(ids: string[], groupId: string | null): Promise<Map<string, StudentStatsDto>> {
    const lessonIds = groupId ? await this.visibleLessonIds(groupId) : [];
    const [completed, quizSubs, assignmentSubs, lastViews] = await Promise.all([
      lessonIds.length === 0
        ? []
        : this.prisma.lessonProgress.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids }, completedAt: { not: null }, lessonId: { in: lessonIds } },
            _count: { _all: true },
          }),
      this.prisma.quizSubmission.findMany({
        where: {
          userId: { in: ids },
          status: 'SUBMITTED',
          quiz: groupId ? { groups: { some: { groupId } } } : undefined,
        },
        select: { userId: true, quizId: true, scorePercent: true, passed: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.assignmentSubmission.findMany({
        where: { studentId: { in: ids }, assignment: groupId ? { groupId } : undefined },
        select: { studentId: true, score: true, submittedAt: true, gradedAt: true, assignment: { select: { maxScore: true } } },
      }),
      this.prisma.lessonProgress.groupBy({
        by: ['studentId'],
        where: { studentId: { in: ids } },
        _max: { lastViewedAt: true },
      }),
    ]);

    const result = new Map<string, StudentStatsDto>();
    for (const studentId of ids) {
      const lessonsCompleted = completed.find((c) => c.studentId === studentId)?._count._all ?? 0;
      // Har test bo'yicha faqat oxirgi urinish (ro'yxat submittedAt desc).
      const byQuiz = new Map<string, (typeof quizSubs)[number]>();
      for (const q of quizSubs) if (q.userId === studentId && !byQuiz.has(q.quizId)) byQuiz.set(q.quizId, q);
      const quizzes = [...byQuiz.values()];
      const subs = assignmentSubs.filter((s) => s.studentId === studentId);
      const graded = subs.filter((s) => s.score !== null);
      const lastActivity = latest(
        ...quizzes.map((q) => q.submittedAt),
        ...subs.map((s) => s.gradedAt ?? s.submittedAt),
        lastViews.find((v) => v.studentId === studentId)?._max.lastViewedAt,
      );

      result.set(studentId, {
        studentId,
        lessonsTotal: lessonIds.length,
        lessonsCompleted,
        progressPercent: lessonIds.length === 0 ? 0 : Math.min(100, Math.round((lessonsCompleted / lessonIds.length) * 100)),
        quizzesTaken: quizzes.length,
        quizzesPassed: quizzes.filter((q) => q.passed).length,
        quizzesAverageScore: avg(quizzes.flatMap((q) => (q.scorePercent === null ? [] : [q.scorePercent]))),
        assignmentsSubmitted: subs.length,
        assignmentsGraded: graded.length,
        // Foizda (score/maxScore), xom ball emas.
        assignmentsAverageScore: avg(
          graded.map((s) => (s.assignment.maxScore > 0 ? ((s.score ?? 0) / s.assignment.maxScore) * 100 : 0)),
        ),
        lastActivityAt: lastActivity > 0 ? new Date(lastActivity).toISOString() : null,
      });
    }
    return result;
  }

  /** Statistika + o'qish vaqti, haftalik faollik, muddati o'tganlar, xavf belgilari. */
  private async overviews(ids: string[], groupId: string | null): Promise<Map<string, StudentOverview>> {
    const now = Date.now();
    const [stats, times, events, assignments] = await Promise.all([
      this.studentStats(ids, groupId),
      this.prisma.lessonProgress.groupBy({ by: ['studentId'], where: { studentId: { in: ids } }, _sum: { timeSpentSec: true } }),
      this.prisma.studyEvent.groupBy({
        by: ['studentId', 'type'],
        where: { studentId: { in: ids }, at: { gte: new Date(now - 7 * DAY) } },
        _count: { _all: true },
      }),
      groupId
        ? this.prisma.assignment.findMany({
            where: { groupId, dueAt: { not: null }, OR: [{ courseId: null }, { course: { isPublished: true } }] },
            select: {
              dueAt: true,
              submissions: { where: { studentId: { in: ids } }, select: { studentId: true } },
              accommodations: { where: { studentId: { in: ids } }, select: { studentId: true, extraMinutes: true, newDueAt: true } },
            },
          })
        : [],
    ]);

    const result = new Map<string, StudentOverview>();
    for (const id of ids) {
      const s = stats.get(id)!;
      const overdueAssignments = assignments.filter((a) => {
        if (a.submissions.some((x) => x.studentId === id)) return false;
        const due = effectiveDueAt(a.dueAt, a.accommodations.find((x) => x.studentId === id) ?? null);
        return !!due && due.getTime() < now;
      }).length;
      const weeklyActivity: Record<string, number> = {};
      for (const e of events) if (e.studentId === id) weeklyActivity[e.type] = e._count._all;

      const risks: string[] = [];
      const last = s.lastActivityAt ? new Date(s.lastActivityAt).getTime() : 0;
      if (last && now - last > 7 * DAY) risks.push('inactive_7d');
      if (s.assignmentsAverageScore !== null && s.assignmentsAverageScore < 50) risks.push('low_avg_score');
      if (overdueAssignments >= 2) risks.push('overdue_2plus');

      result.set(id, {
        ...s,
        totalStudyTimeSec: times.find((t) => t.studentId === id)?._sum.timeSpentSec ?? 0,
        weeklyActivity,
        overdueAssignments,
        risks,
      });
    }
    return result;
  }
}
