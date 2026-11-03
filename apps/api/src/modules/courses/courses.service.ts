import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CourseDto, CourseQuery, CreateCourseInput, UpdateCourseInput } from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { AuditService } from '../../infra/audit.service';
import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { type Actor, type ClientInfo, isStudent, isTeacher } from '../auth/actor';
import { CourseAccess, HIGHER_EDUCATION, STUDENT_LESSON_WHERE } from './course-access.service';
import { COURSE_SELECT, type CourseRow, toCourseDto } from './course.mappers';

const SLUG_TAKEN = 'Bu slug bilan kurs allaqachon mavjud';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccess,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(q: CourseQuery, actor: Actor) {
    const { page, perPage, skip, take } = pageArgs(q);
    // Shartlar AND bilan — o'qituvchi filtri va qidiruv ikkalasi ham OR ishlatadi.
    const and: Prisma.CourseWhereInput[] = [{ educationLevel: HIGHER_EDUCATION }];
    if (isStudent(actor)) {
      const groupId = await this.access.activeGroupId(actor.id);
      if (!groupId) return toPage([], 0, page, perPage);
      and.push(this.access.studentCourseWhere(groupId));
    } else if (q.isPublished !== undefined) {
      and.push({ isPublished: q.isPublished });
    }
    if (isTeacher(actor)) and.push({ OR: [{ ownerId: actor.id }, { visibility: 'LIBRARY' }] });
    if (q.search) {
      and.push({
        OR: [
          { nameUz: { contains: q.search, mode: 'insensitive' } },
          { slug: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.CourseWhereInput = { AND: and };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({ where, select: COURSE_SELECT, orderBy: { createdAt: 'asc' }, skip, take }),
    ]);
    return toPage(await this.toDtos(rows, actor), total, page, perPage);
  }

  async byId(id: string, actor: Actor): Promise<CourseDto> {
    return this.visible(await this.prisma.course.findUnique({ where: { id }, select: COURSE_SELECT }), actor);
  }

  async bySlug(slug: string, actor: Actor): Promise<CourseDto> {
    const row = await this.prisma.course.findUnique({ where: { slug: slug.toLowerCase() }, select: COURSE_SELECT });
    return this.visible(row, actor);
  }

  async create(input: CreateCourseInput, actor: Actor, client: ClientInfo): Promise<CourseDto> {
    const slug = input.slug.trim().toLowerCase();
    await this.assertSlugFree(slug);
    const row = await this.withSlugConflict(() =>
      this.prisma.course.create({
        data: {
          slug,
          nameUz: input.nameUz.trim(),
          descriptionUz: input.descriptionUz?.trim() ?? null,
          // Darajalar olib tashlangan — har kurs oliy ta'lim kursi.
          educationLevel: HIGHER_EDUCATION,
          isPublished: input.isPublished,
          visibility: input.visibility,
          // Kurs egasi — yaratuvchi (SA yaratsa ham).
          ownerId: actor.id,
        },
        select: COURSE_SELECT,
      }),
    );
    await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'Course', subjectId: row.id, ...client });
    return toCourseDto(row);
  }

  async update(id: string, input: UpdateCourseInput, actor: Actor, client: ClientInfo): Promise<CourseDto> {
    await this.access.loadForManage(id, actor);
    const slug = input.slug?.trim().toLowerCase();
    if (slug !== undefined) await this.assertSlugFree(slug, id);

    const row = await this.withSlugConflict(() =>
      this.prisma.course.update({
        where: { id },
        data: {
          slug,
          nameUz: input.nameUz?.trim(),
          descriptionUz: input.descriptionUz === undefined ? undefined : (input.descriptionUz?.trim() ?? null),
          isPublished: input.isPublished,
          visibility: input.visibility,
        },
        select: COURSE_SELECT,
      }),
    );
    await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'Course', subjectId: id, changes: input, ...client });
    return toCourseDto(row);
  }

  /** Faqat SA (kontroller). Darslar/modullar/materiallar kaskad o'chadi — fayllar ham. */
  async remove(id: string, actor: Actor, client: ClientInfo) {
    const existing = await this.prisma.course.findUnique({
      where: { id },
      select: { _count: { select: { lessons: true } }, materials: { select: { storageKey: true } } },
    });
    if (!existing) throw new NotFoundException('Kurs topilmadi');
    await this.prisma.course.delete({ where: { id } });
    await Promise.all(existing.materials.map((m) => this.storage.remove(m.storageKey)));
    await this.audit.record({
      userId: actor.id,
      action: 'DELETE',
      subjectType: 'Course',
      subjectId: id,
      changes: { lessonsRemoved: existing._count.lessons },
      ...client,
    });
    return { ok: true };
  }

  private async visible(row: CourseRow | null, actor: Actor): Promise<CourseDto> {
    await this.access.assertCanView(row, actor);
    const [dto] = await this.toDtos([row!], actor);
    return dto!;
  }

  /** Talaba uchun lessonsCount — faqat unga ko'rinadigan darslar. */
  private async toDtos(rows: CourseRow[], actor: Actor): Promise<CourseDto[]> {
    if (!isStudent(actor) || rows.length === 0) return rows.map((r) => toCourseDto(r));
    const counts = await this.prisma.lesson.groupBy({
      by: ['courseId'],
      where: { courseId: { in: rows.map((r) => r.id) }, ...STUDENT_LESSON_WHERE },
      _count: { _all: true },
    });
    const byCourse = new Map(counts.map((c) => [c.courseId, c._count._all]));
    return rows.map((r) => toCourseDto(r, byCourse.get(r.id) ?? 0));
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const clash = await this.prisma.course.findFirst({
      where: { slug, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    if (clash) throw new ConflictException(SLUG_TAKEN);
  }

  private async withSlugConflict<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(SLUG_TAKEN);
      throw err;
    }
  }
}
