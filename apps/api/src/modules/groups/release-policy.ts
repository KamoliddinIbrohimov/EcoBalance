import { BadRequestException, Injectable } from '@nestjs/common';
import type { GroupLessonReleaseStatus } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.service';

export interface ReleaseWindow {
  status: GroupLessonReleaseStatus;
  opensAt: Date | null;
  closesAt: Date | null;
}

/**
 * LOCKED — doim yopiq. closesAt o'tgach — yopiq. OPEN — ochiq.
 * SCHEDULED — opensAt kelgach ochiq.
 */
export function isReleaseOpenNow(r: ReleaseWindow, now = Date.now()): boolean {
  if (r.status === 'LOCKED') return false;
  if (r.closesAt && r.closesAt.getTime() < now) return false;
  if (r.status === 'OPEN') return true;
  return !!r.opensAt && r.opensAt.getTime() <= now;
}

export function assertOpenBeforeClose(s: { opensAt: Date | null; closesAt: Date | null }) {
  if (s.opensAt && s.closesAt && s.opensAt.getTime() >= s.closesAt.getTime()) {
    throw new BadRequestException('opensAt closesAt dan oldin bo‘lishi kerak');
  }
}

export interface LessonRef {
  id: string;
  moduleId: string | null;
}

/**
 * Talaba nuqtai nazaridan guruh: boshqa modullar (courses, learning) uchun.
 * Talaba faqat bitta guruhda bo'ladi. Dars uchun release bo'lmasa — ochiq;
 * dars darajasidagi release modul darajasidagisidan ustun.
 */
@Injectable()
export class StudentGroupService {
  constructor(private readonly prisma: PrismaService) {}

  /** Talabaning guruhi (nofaol bo'lsa ham) yoki null. */
  async groupOf(studentId: string): Promise<{ groupId: string; isActive: boolean } | null> {
    const m = await this.prisma.groupMember.findUnique({
      where: { studentId },
      select: { groupId: true, group: { select: { isActive: true } } },
    });
    return m ? { groupId: m.groupId, isActive: m.group.isActive } : null;
  }

  /** Faqat faol guruh ID'si — kontentga kirish shu orqali. */
  async activeGroupId(studentId: string): Promise<string | null> {
    const g = await this.groupOf(studentId);
    return g?.isActive ? g.groupId : null;
  }

  /** Kurs talabaning (faol) guruhiga biriktirilganmi. */
  async hasCourse(studentId: string, courseId: string): Promise<boolean> {
    const groupId = await this.activeGroupId(studentId);
    if (!groupId) return false;
    const link = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId, groupId } },
      select: { courseId: true },
    });
    return !!link;
  }

  /**
   * Guruhning barcha release'lari bitta so'rovda; qaytgan funksiya dars uchun
   * amaldagi release'ni (yoki null — cheklov yo'q) beradi. Ro'yxatlar uchun.
   */
  async releaseResolver(groupId: string): Promise<(lesson: LessonRef) => ReleaseWindow | null> {
    const rows = await this.prisma.groupLessonRelease.findMany({
      where: { groupId },
      select: { lessonId: true, moduleId: true, status: true, opensAt: true, closesAt: true },
    });
    const byLesson = new Map(rows.filter((r) => r.lessonId).map((r) => [r.lessonId!, r]));
    const byModule = new Map(rows.filter((r) => r.moduleId).map((r) => [r.moduleId!, r]));
    return (lesson) =>
      byLesson.get(lesson.id) ?? (lesson.moduleId ? byModule.get(lesson.moduleId) : undefined) ?? null;
  }

  /** Dars shu guruh uchun hozir ochiqmi. */
  async isLessonOpen(groupId: string, lesson: LessonRef): Promise<boolean> {
    const rows = await this.prisma.groupLessonRelease.findMany({
      where: {
        groupId,
        OR: [{ lessonId: lesson.id }, ...(lesson.moduleId ? [{ moduleId: lesson.moduleId }] : [])],
      },
      select: { lessonId: true, status: true, opensAt: true, closesAt: true },
    });
    const release = rows.find((r) => r.lessonId === lesson.id) ?? rows[0];
    return !release || isReleaseOpenNow(release);
  }
}
