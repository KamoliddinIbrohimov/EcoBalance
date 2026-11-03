import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CreateLessonInput, LessonDto, LessonWithCourseDto, UpdateLessonInput } from '@eco/shared';

import { AuditService } from '../../infra/audit.service';
import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { type Actor, type ClientInfo, isStudent } from '../auth/actor';
import { COURSE_REF_SELECT, CourseAccess, STUDENT_LESSON_WHERE } from './course-access.service';
import { LESSON_SELECT, type LessonRow, stripLessonBody, toLessonDto } from './course.mappers';

const LESSON_NOT_FOUND = 'Dars topilmadi';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccess,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Kurs darslari tartib bo'yicha. Talabaga faqat ko'rinadiganlari, release
   * ochilmaganlarining mazmuni kesilgan holda (sarlavha ko'rinadi).
   */
  async listByCourse(courseId: string, actor: Actor): Promise<LessonDto[]> {
    await this.access.loadForView(courseId, actor);
    const student = isStudent(actor);
    const rows = await this.prisma.lesson.findMany({
      where: { courseId, ...(student ? STUDENT_LESSON_WHERE : {}) },
      select: LESSON_SELECT,
      orderBy: { orderIndex: 'asc' },
    });
    if (!student) return rows.map(toLessonDto);
    const releases = await this.access.releasesFor(actor.id);
    return rows.map((r) => (releases.isOpen(r) ? toLessonDto(r) : stripLessonBody(toLessonDto(r))));
  }

  async byId(id: string, actor: Actor): Promise<LessonWithCourseDto> {
    const row = await this.prisma.lesson.findUnique({
      where: { id },
      select: {
        ...LESSON_SELECT,
        module: { select: { isPublished: true } },
        course: { select: { ...COURSE_REF_SELECT, slug: true, nameUz: true } },
      },
    });
    if (!row) throw new NotFoundException(LESSON_NOT_FOUND);
    await this.access.assertCanView(row.course, actor, LESSON_NOT_FOUND);
    if (isStudent(actor)) {
      const hidden = !row.isPublished || row.archivedAt || (row.module && !row.module.isPublished);
      if (hidden) throw new NotFoundException(LESSON_NOT_FOUND);
      if (!(await this.access.isLessonOpenFor(actor, row))) throw new NotFoundException('Dars hali ochilmagan');
    }
    const { module: _module, course, ...lesson } = row;
    return { ...toLessonDto(lesson), course: { id: course.id, slug: course.slug, nameUz: course.nameUz } };
  }

  async create(input: CreateLessonInput, actor: Actor, client: ClientInfo): Promise<LessonDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { ...COURSE_REF_SELECT, slug: true, nameUz: true },
    });
    this.access.assertCanManage(course, actor);
    if (input.moduleId) await this.assertModuleInCourse(input.moduleId, input.courseId);
    await this.assertOrderFree(input.courseId, input.orderIndex);

    const row = await this.withOrderConflict(input.orderIndex, () =>
      this.prisma.lesson.create({
        data: {
          courseId: input.courseId,
          moduleId: input.moduleId ?? null,
          orderIndex: input.orderIndex,
          lessonType: input.lessonType,
          titleUz: input.titleUz.trim(),
          objectiveUz: input.objectiveUz?.trim() ?? null,
          equipmentUz: input.equipmentUz?.trim() ?? null,
          theoryUz: input.theoryUz?.trim() ?? null,
          procedureUz: input.procedureUz,
          isPublished: input.isPublished,
          estimatedMinutes: input.estimatedMinutes ?? null,
        },
        select: LESSON_SELECT,
      }),
    );
    await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'Lesson', subjectId: row.id, ...client });
    await this.notifyStudents(course, row);
    return toLessonDto(row);
  }

  async update(id: string, input: UpdateLessonInput, actor: Actor, client: ClientInfo): Promise<LessonDto> {
    const existing = await this.loadForManage(id, actor);
    if (input.moduleId) await this.assertModuleInCourse(input.moduleId, existing.courseId);
    if (input.orderIndex !== undefined && input.orderIndex !== existing.orderIndex) {
      await this.assertOrderFree(existing.courseId, input.orderIndex, id);
    }
    const trimOrNull = (v: string | null | undefined) => (v === undefined ? undefined : (v?.trim() ?? null));

    const row = await this.withOrderConflict(input.orderIndex ?? existing.orderIndex, () =>
      this.prisma.lesson.update({
        where: { id },
        data: {
          moduleId: input.moduleId,
          orderIndex: input.orderIndex,
          lessonType: input.lessonType,
          titleUz: input.titleUz?.trim(),
          objectiveUz: trimOrNull(input.objectiveUz),
          equipmentUz: trimOrNull(input.equipmentUz),
          theoryUz: trimOrNull(input.theoryUz),
          procedureUz: input.procedureUz,
          isPublished: input.isPublished,
          estimatedMinutes: input.estimatedMinutes,
        },
        select: LESSON_SELECT,
      }),
    );
    await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'Lesson', subjectId: id, changes: input, ...client });
    return toLessonDto(row);
  }

  /**
   * Standart — arxivlash (progress saqlanadi, talabadan yashiriladi).
   * `hard` — to'liq o'chirish (materiallar fayllari bilan).
   */
  async remove(id: string, hard: boolean, actor: Actor, client: ClientInfo) {
    await this.loadForManage(id, actor);
    if (!hard) {
      await this.prisma.lesson.update({ where: { id }, data: { archivedAt: new Date(), isPublished: false } });
      await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'Lesson', subjectId: id, changes: { archived: true }, ...client });
      return { ok: true, archived: true };
    }
    const materials = await this.prisma.courseMaterial.findMany({ where: { lessonId: id }, select: { storageKey: true } });
    await this.prisma.lesson.delete({ where: { id } });
    await Promise.all(materials.map((m) => this.storage.remove(m.storageKey)));
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'Lesson', subjectId: id, ...client });
    return { ok: true };
  }

  private async loadForManage(id: string, actor: Actor) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { courseId: true, orderIndex: true, course: { select: COURSE_REF_SELECT } },
    });
    if (!lesson) throw new NotFoundException(LESSON_NOT_FOUND);
    this.access.assertCanManage(lesson.course, actor, LESSON_NOT_FOUND);
    return lesson;
  }

  private async assertModuleInCourse(moduleId: string, courseId: string) {
    const mod = await this.prisma.module.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
    if (!mod) throw new NotFoundException('Modul topilmadi (bu kursda emas)');
  }

  private async assertOrderFree(courseId: string, orderIndex: number, exceptId?: string) {
    const clash = await this.prisma.lesson.findFirst({
      where: { courseId, orderIndex, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`Ushbu kursda #${orderIndex} tartibli dars allaqachon mavjud`);
  }

  private async withOrderConflict<T>(orderIndex: number, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`Ushbu kursda #${orderIndex} tartibli dars allaqachon mavjud`);
      throw err;
    }
  }

  /**
   * Nashr etilgan kursga ko'rinadigan dars qo'shilsa — biriktirilgan faol
   * guruhlar talabalariga bildirishnoma. Xato dars yaratishni yiqitmaydi.
   */
  private async notifyStudents(
    course: { id: string; slug: string; nameUz: string; isPublished: boolean },
    lesson: LessonRow,
  ) {
    if (!course.isPublished || !lesson.isPublished) return;
    try {
      if (lesson.moduleId) {
        const mod = await this.prisma.module.findUnique({ where: { id: lesson.moduleId }, select: { isPublished: true } });
        if (!mod?.isPublished) return;
      }
      const members = await this.prisma.groupMember.findMany({
        where: { group: { isActive: true, courses: { some: { courseId: course.id } } } },
        select: { studentId: true },
      });
      if (members.length === 0) return;
      await this.prisma.notification.createMany({
        data: members.map((m) => ({
          userId: m.studentId,
          type: 'LESSON_CREATED',
          titleUz: 'Yangi dars qo‘shildi',
          bodyUz: `"${course.nameUz}" kursida: ${lesson.titleUz}`.slice(0, 8000),
          data: { lessonId: lesson.id, courseId: course.id, courseSlug: course.slug },
        })),
      });
    } catch (err) {
      this.logger.error({ err, lessonId: lesson.id }, 'Dars bildirishnomasi yuborilmadi');
    }
  }
}
