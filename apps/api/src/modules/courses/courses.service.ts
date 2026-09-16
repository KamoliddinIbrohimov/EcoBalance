import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type {
  CourseDto,
  CourseQuery,
  CreateCourseInput,
  CreateLessonInput,
  LessonDto,
  LessonQuery,
  LessonWithCourseDto,
  UpdateCourseInput,
  UpdateLessonInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestContext {
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

const COURSE_SELECT = {
  id: true,
  slug: true,
  nameUz: true,
  descriptionUz: true,
  educationLevel: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { lessons: true } },
} satisfies Prisma.CourseSelect;

type CourseRow = Prisma.CourseGetPayload<{ select: typeof COURSE_SELECT }>;

function toCourseDto(row: CourseRow): CourseDto {
  return {
    id: row.id,
    slug: row.slug,
    nameUz: row.nameUz,
    descriptionUz: row.descriptionUz,
    educationLevel: row.educationLevel,
    isPublished: row.isPublished,
    lessonsCount: row._count.lessons,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const LESSON_SELECT = {
  id: true,
  courseId: true,
  orderIndex: true,
  lessonType: true,
  titleUz: true,
  objectiveUz: true,
  equipmentUz: true,
  theoryUz: true,
  procedureUz: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonSelect;

type LessonRow = Prisma.LessonGetPayload<{ select: typeof LESSON_SELECT }>;

function toLessonDto(row: LessonRow): LessonDto {
  const procedure = Array.isArray(row.procedureUz)
    ? (row.procedureUz as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return {
    id: row.id,
    courseId: row.courseId,
    orderIndex: row.orderIndex,
    lessonType: row.lessonType,
    titleUz: row.titleUz,
    objectiveUz: row.objectiveUz,
    equipmentUz: row.equipmentUz,
    theoryUz: row.theoryUz,
    procedureUz: procedure,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------- Courses -------------

  async listCourses(query: CourseQuery) {
    const { page, perPage, search, isPublished, educationLevel } = query;

    const where: Prisma.CourseWhereInput = {
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(educationLevel ? { educationLevel } : {}),
      ...(search
        ? {
            OR: [
              { nameUz: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        select: COURSE_SELECT,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toCourseDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findCourseBySlug(slug: string): Promise<CourseDto> {
    const row = await this.prisma.course.findUnique({
      where: { slug: slug.toLowerCase() },
      select: COURSE_SELECT,
    });
    if (!row) throw new NotFoundException('Kurs topilmadi');
    return toCourseDto(row);
  }

  async findCourseById(id: string): Promise<CourseDto> {
    const row = await this.prisma.course.findUnique({ where: { id }, select: COURSE_SELECT });
    if (!row) throw new NotFoundException('Kurs topilmadi');
    return toCourseDto(row);
  }

  async createCourse(dto: CreateCourseInput, ctx: RequestContext): Promise<CourseDto> {
    const slug = dto.slug.trim().toLowerCase();
    const clash = await this.prisma.course.findUnique({ where: { slug } });
    if (clash) throw new ConflictException('Bu slug bilan kurs allaqachon mavjud');

    const row = await this.prisma.course.create({
      data: {
        id: uuidv7(),
        slug,
        nameUz: dto.nameUz.trim(),
        descriptionUz: dto.descriptionUz?.trim() ?? null,
        educationLevel: dto.educationLevel,
        isPublished: dto.isPublished ?? false,
      },
      select: COURSE_SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'Course',
      subjectId: row.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toCourseDto(row);
  }

  async updateCourse(id: string, dto: UpdateCourseInput, ctx: RequestContext): Promise<CourseDto> {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kurs topilmadi');

    let slug: string | undefined;
    if (dto.slug !== undefined) {
      slug = dto.slug.trim().toLowerCase();
      const clash = await this.prisma.course.findFirst({ where: { slug, NOT: { id } } });
      if (clash) throw new ConflictException('Bu slug bilan kurs allaqachon mavjud');
    }

    const row = await this.prisma.course.update({
      where: { id },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.nameUz !== undefined ? { nameUz: dto.nameUz.trim() } : {}),
        ...(dto.descriptionUz !== undefined
          ? { descriptionUz: dto.descriptionUz?.trim() ?? null }
          : {}),
        ...(dto.educationLevel !== undefined ? { educationLevel: dto.educationLevel } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
      select: COURSE_SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'Course',
      subjectId: id,
      changes: dto as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toCourseDto(row);
  }

  async removeCourse(id: string, ctx: RequestContext) {
    const existing = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true } } },
    });
    if (!existing) throw new NotFoundException('Kurs topilmadi');

    // Lessons cascade-delete tufayli avtomatik o'chadi.
    await this.prisma.course.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'Course',
      subjectId: id,
      changes: { lessonsRemoved: existing._count.lessons } as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }

  // ------------- Lessons -------------

  async listLessons(query: LessonQuery) {
    const { page, perPage, search, courseId, lessonType } = query;

    const where: Prisma.LessonWhereInput = {
      ...(courseId ? { courseId } : {}),
      ...(lessonType ? { lessonType } : {}),
      ...(search
        ? { titleUz: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.lesson.count({ where }),
      this.prisma.lesson.findMany({
        where,
        select: LESSON_SELECT,
        orderBy: [{ courseId: 'asc' }, { orderIndex: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toLessonDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async listLessonsByCourse(courseId: string): Promise<LessonDto[]> {
    const rows = await this.prisma.lesson.findMany({
      where: { courseId },
      select: LESSON_SELECT,
      orderBy: { orderIndex: 'asc' },
    });
    return rows.map(toLessonDto);
  }

  async findLessonById(id: string): Promise<LessonWithCourseDto> {
    const row = await this.prisma.lesson.findUnique({
      where: { id },
      select: {
        ...LESSON_SELECT,
        course: { select: { id: true, slug: true, nameUz: true } },
      },
    });
    if (!row) throw new NotFoundException('Dars topilmadi');
    return { ...toLessonDto(row), course: row.course };
  }

  async createLesson(dto: CreateLessonInput, ctx: RequestContext): Promise<LessonDto> {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Kurs topilmadi');

    const clash = await this.prisma.lesson.findFirst({
      where: { courseId: dto.courseId, orderIndex: dto.orderIndex },
    });
    if (clash) {
      throw new ConflictException(
        `Ushbu kursda #${dto.orderIndex} tartibli dars allaqachon mavjud`,
      );
    }

    const row = await this.prisma.lesson.create({
      data: {
        id: uuidv7(),
        courseId: dto.courseId,
        orderIndex: dto.orderIndex,
        lessonType: dto.lessonType,
        titleUz: dto.titleUz.trim(),
        objectiveUz: dto.objectiveUz?.trim() ?? null,
        equipmentUz: dto.equipmentUz?.trim() ?? null,
        theoryUz: dto.theoryUz?.trim() ?? null,
        procedureUz: (dto.procedureUz ?? []) as Prisma.InputJsonValue,
      },
      select: LESSON_SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'Lesson',
      subjectId: row.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Barcha faol foydalanuvchilarga yangi dars haqida bildirishnoma
    await this.notifications.broadcast({
      type: 'LESSON_CREATED',
      titleUz: 'Yangi dars qo‘shildi',
      bodyUz: `"${course.nameUz}" kursida: ${row.titleUz}`,
      data: { lessonId: row.id, courseId: course.id, courseSlug: course.slug },
    });

    return toLessonDto(row);
  }

  async updateLesson(
    id: string,
    dto: UpdateLessonInput,
    ctx: RequestContext,
  ): Promise<LessonDto> {
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dars topilmadi');

    if (dto.orderIndex !== undefined && dto.orderIndex !== existing.orderIndex) {
      const clash = await this.prisma.lesson.findFirst({
        where: {
          courseId: existing.courseId,
          orderIndex: dto.orderIndex,
          NOT: { id },
        },
      });
      if (clash) {
        throw new ConflictException(
          `Ushbu kursda #${dto.orderIndex} tartibli dars allaqachon mavjud`,
        );
      }
    }

    const row = await this.prisma.lesson.update({
      where: { id },
      data: {
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
        ...(dto.lessonType !== undefined ? { lessonType: dto.lessonType } : {}),
        ...(dto.titleUz !== undefined ? { titleUz: dto.titleUz.trim() } : {}),
        ...(dto.objectiveUz !== undefined
          ? { objectiveUz: dto.objectiveUz?.trim() ?? null }
          : {}),
        ...(dto.equipmentUz !== undefined
          ? { equipmentUz: dto.equipmentUz?.trim() ?? null }
          : {}),
        ...(dto.theoryUz !== undefined ? { theoryUz: dto.theoryUz?.trim() ?? null } : {}),
        ...(dto.procedureUz !== undefined
          ? { procedureUz: dto.procedureUz as Prisma.InputJsonValue }
          : {}),
      },
      select: LESSON_SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'Lesson',
      subjectId: id,
      changes: dto as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toLessonDto(row);
  }

  async removeLesson(id: string, ctx: RequestContext) {
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dars topilmadi');

    await this.prisma.lesson.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'Lesson',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }
}
