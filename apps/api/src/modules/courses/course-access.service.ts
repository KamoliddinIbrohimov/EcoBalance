import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContentVisibility, GroupLessonRelease, Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.service';
import { type Actor, isAdmin, isStudent, isTeacher } from '../auth/actor';

/**
 * Platforma faqat oliy ta'lim uchun. Boshqa darajadagi eski kurslar bazada
 * saqlanadi, lekin hech kimga ko'rinmaydi va tahrirlanmaydi.
 */
export const HIGHER_EDUCATION = 'oliy-talim';

/** Ruxsat tekshiruvi uchun kursning minimal ko'rinishi. */
export interface CourseRef {
  id: string;
  ownerId: string | null;
  visibility: ContentVisibility;
  isPublished: boolean;
  educationLevel: string;
}

export const COURSE_REF_SELECT = {
  id: true,
  ownerId: true,
  visibility: true,
  isPublished: true,
  educationLevel: true,
} satisfies Prisma.CourseSelect;

/**
 * Talabaga ko'rinadigan dars: nashr etilgan, arxivlanmagan va moduli
 * (bo'lsa) nashr etilgan.
 */
export const STUDENT_LESSON_WHERE = {
  isPublished: true,
  archivedAt: null,
  OR: [{ moduleId: null }, { module: { isPublished: true } }],
} satisfies Prisma.LessonWhereInput;

type ReleaseState = Pick<GroupLessonRelease, 'status' | 'opensAt' | 'closesAt'>;

/**
 * LOCKED — doim yopiq. closesAt o'tgan bo'lsa — yopiq. OPEN — ochiq.
 * SCHEDULED — opensAt yetib kelgandan keyin ochiq.
 */
export function isReleaseOpen(r: ReleaseState, now = Date.now()): boolean {
  if (r.status === 'LOCKED') return false;
  if (r.closesAt && r.closesAt.getTime() < now) return false;
  if (r.status === 'OPEN') return true;
  return !!r.opensAt && r.opensAt.getTime() <= now;
}

/** Guruh release'lari: dars uchun alohida qoida moduldagidan ustun. */
export class ReleaseLookup {
  private readonly byLesson = new Map<string, ReleaseState>();
  private readonly byModule = new Map<string, ReleaseState>();

  constructor(releases: GroupLessonRelease[]) {
    for (const r of releases) {
      if (r.lessonId) this.byLesson.set(r.lessonId, r);
      else if (r.moduleId) this.byModule.set(r.moduleId, r);
    }
  }

  /** Release yo'q — dars standart bo'yicha ochiq. */
  isOpen(lesson: { id: string; moduleId: string | null }): boolean {
    const rel = this.byLesson.get(lesson.id) ?? (lesson.moduleId ? this.byModule.get(lesson.moduleId) : undefined);
    return !rel || isReleaseOpen(rel);
  }
}

/**
 * Kurs kontentiga kirish siyosati (kurslar, darslar, modullar, materiallar):
 * - SA — hammasi;
 * - o'qituvchi — o'z kurslari + LIBRARY (LIBRARY'ni faqat o'qiydi);
 * - talaba — FAOL guruhiga biriktirilgan, nashr etilgan kurslar.
 * Ko'rinmaydigan resurs uchun 404, ko'rinadigan-u tahrirlab bo'lmaydigani uchun 403.
 *
 * Boshqa modullar (groups, learning) ham shu servisni ishlatishi mumkin —
 * CoursesModule uni eksport qiladi.
 */
@Injectable()
export class CourseAccess {
  constructor(private readonly prisma: PrismaService) {}

  /** Talabaning faol guruhi; guruhsiz yoki guruh nofaol bo'lsa null. */
  async activeGroupId(studentId: string): Promise<string | null> {
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId },
      select: { groupId: true, group: { select: { isActive: true } } },
    });
    return member?.group.isActive ? member.groupId : null;
  }

  /** Talabaga ko'rinadigan kurslar filtri (guruh allaqachon aniqlangan bo'lsa). */
  studentCourseWhere(groupId: string): Prisma.CourseWhereInput {
    return { isPublished: true, educationLevel: HIGHER_EDUCATION, groups: { some: { groupId } } };
  }

  async canView(course: CourseRef, actor: Actor): Promise<boolean> {
    if (course.educationLevel !== HIGHER_EDUCATION) return false;
    if (isAdmin(actor)) return true;
    if (isTeacher(actor)) return course.ownerId === actor.id || course.visibility === 'LIBRARY';
    if (!course.isPublished) return false;
    const groupId = await this.activeGroupId(actor.id);
    if (!groupId) return false;
    const link = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId: course.id, groupId } },
      select: { courseId: true },
    });
    return !!link;
  }

  async assertCanView(course: CourseRef | null, actor: Actor, notFound = 'Kurs topilmadi'): Promise<void> {
    if (!course || !(await this.canView(course, actor))) throw new NotFoundException(notFound);
  }

  /** Kursni (va uning darslari/modullari/materiallarini) tahrirlash huquqi. */
  assertCanManage(course: CourseRef | null, actor: Actor, notFound = 'Kurs topilmadi'): asserts course is CourseRef {
    if (!course || course.educationLevel !== HIGHER_EDUCATION) throw new NotFoundException(notFound);
    if (isAdmin(actor) || (course.ownerId !== null && course.ownerId === actor.id)) return;
    if (isTeacher(actor) && course.visibility === 'LIBRARY') {
      throw new ForbiddenException('Faqat o‘z kursingizni tahrirlay olasiz');
    }
    throw new NotFoundException(notFound);
  }

  async loadForView(courseId: string, actor: Actor, notFound = 'Kurs topilmadi'): Promise<CourseRef> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: COURSE_REF_SELECT });
    await this.assertCanView(course, actor, notFound);
    return course!;
  }

  async loadForManage(courseId: string, actor: Actor, notFound = 'Kurs topilmadi'): Promise<CourseRef> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: COURSE_REF_SELECT });
    this.assertCanManage(course, actor, notFound);
    return course;
  }

  /** Talaba guruhining release'lari; guruh yo'q bo'lsa — bo'sh (hammasi ochiq). */
  async releasesFor(studentId: string): Promise<ReleaseLookup> {
    const groupId = await this.activeGroupId(studentId);
    const rows = groupId ? await this.prisma.groupLessonRelease.findMany({ where: { groupId } }) : [];
    return new ReleaseLookup(rows);
  }

  /**
   * Talaba uchun darsning ochiqligi. Kursga kirish oldindan tekshirilgan
   * bo'lishi kerak.
   */
  async isLessonOpenFor(actor: Actor, lesson: { id: string; moduleId: string | null }): Promise<boolean> {
    if (!isStudent(actor)) return true;
    return (await this.releasesFor(actor.id)).isOpen(lesson);
  }
}
