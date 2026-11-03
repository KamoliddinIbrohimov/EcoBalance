import { Injectable, NotFoundException } from '@nestjs/common';
import type { GroupLessonReleaseStatus } from '@prisma/client';
import type { HeartbeatInput } from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import { type Actor, isStudent } from '../auth/actor';
import { LearningAccess } from './learning-access.service';
import { iso } from './learning.mappers';

/** Bitta heartbeat qo'sha oladigan eng ko'p soniya (frontend ~30s da yuboradi). */
const MAX_SECONDS_PER_BEAT = 60;
/** Bundan tez kelgan ketma-ket heartbeat'lar vaqt qo'shmaydi. */
const MIN_BEAT_INTERVAL_SEC = 10;

interface Release {
  status: GroupLessonReleaseStatus;
  opensAt: Date | null;
  closesAt: Date | null;
}

/** LOCKED — yopiq; closesAt o'tgan — yopiq; SCHEDULED — opensAt kelgach ochiq. */
function isReleaseOpen(r: Release, now = Date.now()): boolean {
  if (r.status === 'LOCKED') return false;
  if (r.closesAt && r.closesAt.getTime() < now) return false;
  if (r.status === 'OPEN') return true;
  return !!r.opensAt && r.opensAt.getTime() <= now;
}

/** Dars progressi va o'qish vaqtini kuzatish (faqat talaba). */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LearningAccess,
  ) {}

  async mark(lessonId: string, completed: boolean, actor: Actor) {
    await this.assertLessonOpen(lessonId, actor.id);
    const now = new Date();
    const key = { studentId_lessonId: { studentId: actor.id, lessonId } };
    const before = await this.prisma.lessonProgress.findUnique({ where: key, select: { completedAt: true } });
    const completedAt = completed ? (before?.completedAt ?? now) : null;

    const row = await this.prisma.lessonProgress.upsert({
      where: key,
      create: { studentId: actor.id, lessonId, completedAt, lastViewedAt: now, firstViewedAt: now, viewCount: 1 },
      update: { completedAt, lastViewedAt: now },
    });
    if (completed && !before?.completedAt) {
      await this.prisma.studyEvent.create({ data: { studentId: actor.id, type: 'LESSON_COMPLETE', refId: lessonId, at: now } });
    }
    return {
      id: row.id,
      studentId: row.studentId,
      lessonId: row.lessonId,
      completedAt: iso(row.completedAt),
      lastViewedAt: row.lastViewedAt.toISOString(),
    };
  }

  async mine(actor: Actor) {
    if (!isStudent(actor)) return [];
    const rows = await this.prisma.lessonProgress.findMany({
      where: { studentId: actor.id },
      orderBy: { lastViewedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      lessonId: r.lessonId,
      completedAt: iso(r.completedAt),
      lastViewedAt: r.lastViewedAt.toISOString(),
      firstViewedAt: iso(r.firstViewedAt),
      viewCount: r.viewCount,
      timeSpentSec: r.timeSpentSec,
      lastPosition: r.lastPosition,
    }));
  }

  /**
   * Dars sahifasidagi faol vaqt. Soxta vaqtga qarshi: bitta so'rov ≤60s,
   * oldingi heartbeat'dan o'tgan vaqtdan (+5s) ko'p emas, 10s'dan tez — 0.
   */
  async heartbeat(lessonId: string, input: HeartbeatInput, actor: Actor) {
    await this.assertLessonOpen(lessonId, actor.id);
    const now = new Date();
    const key = { studentId_lessonId: { studentId: actor.id, lessonId } };
    const current = await this.prisma.lessonProgress.findUnique({ where: key, select: { lastViewedAt: true } });

    let added = Math.min(input.activeSeconds, MAX_SECONDS_PER_BEAT);
    if (current) {
      const sinceLast = Math.floor((now.getTime() - current.lastViewedAt.getTime()) / 1000);
      added = sinceLast < MIN_BEAT_INTERVAL_SEC ? 0 : Math.min(added, sinceLast + 5);
    }

    await this.prisma.lessonProgress.upsert({
      where: key,
      create: {
        studentId: actor.id,
        lessonId,
        firstViewedAt: now,
        lastViewedAt: now,
        viewCount: 1,
        timeSpentSec: added,
        lastPosition: input.position ?? 0,
      },
      update: { lastViewedAt: now, timeSpentSec: { increment: added }, lastPosition: input.position },
    });
    // Nol soniyali hodisalar statistikani "bo'sh faollik" bilan to'ldirmasin.
    if (added > 0) {
      await this.prisma.studyEvent.create({
        data: {
          studentId: actor.id,
          type: 'LESSON_HEARTBEAT',
          refId: lessonId,
          meta: { activeSeconds: added, position: input.position ?? null },
          at: now,
        },
      });
    }
    return { ok: true, addedSeconds: added };
  }

  /**
   * Talabaga ochiq dars: kurs, modul va dars nashr etilgan, arxivlanmagan;
   * talaba FAOL guruhda, kurs shu guruhga biriktirilgan; dars (yoki moduli)
   * uchun release ochiq. Aks holda 404.
   */
  private async assertLessonOpen(lessonId: string, studentId: string) {
    const [lesson, member] = await Promise.all([
      this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
          courseId: true,
          moduleId: true,
          isPublished: true,
          archivedAt: true,
          course: { select: { isPublished: true } },
          module: { select: { isPublished: true } },
        },
      }),
      this.access.membership(studentId),
    ]);
    const published =
      lesson && lesson.course.isPublished && lesson.isPublished && !lesson.archivedAt && lesson.module?.isPublished !== false;
    if (!published || !member?.group.isActive) throw new NotFoundException('Dars topilmadi');

    const [link, releases] = await Promise.all([
      this.prisma.courseGroup.findUnique({
        where: { courseId_groupId: { courseId: lesson.courseId, groupId: member.groupId } },
        select: { courseId: true },
      }),
      this.prisma.groupLessonRelease.findMany({
        where: {
          groupId: member.groupId,
          OR: [{ lessonId }, ...(lesson.moduleId ? [{ moduleId: lesson.moduleId }] : [])],
        },
        select: { lessonId: true, status: true, opensAt: true, closesAt: true },
      }),
    ]);
    if (!link) throw new NotFoundException('Dars topilmadi');

    // Dars darajasidagi release modul darajasidagidan ustun.
    const release = releases.find((r) => r.lessonId === lessonId) ?? releases[0];
    if (release && !isReleaseOpen(release)) throw new NotFoundException('Dars hali ochilmagan');
  }
}
