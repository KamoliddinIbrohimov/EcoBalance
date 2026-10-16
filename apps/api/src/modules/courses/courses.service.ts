import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  visibility: true,
  ownerId: true,
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
    visibility: row.visibility,
    ownerId: row.ownerId,
    lessonsCount: row._count.lessons,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const LESSON_SELECT = {
  id: true,
  courseId: true,
  moduleId: true,
  orderIndex: true,
  lessonType: true,
  titleUz: true,
  objectiveUz: true,
  equipmentUz: true,
  theoryUz: true,
  procedureUz: true,
  isPublished: true,
  archivedAt: true,
  estimatedMinutes: true,
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
    moduleId: row.moduleId,
    orderIndex: row.orderIndex,
    lessonType: row.lessonType,
    titleUz: row.titleUz,
    objectiveUz: row.objectiveUz,
    equipmentUz: row.equipmentUz,
    theoryUz: row.theoryUz,
    procedureUz: procedure,
    isPublished: row.isPublished,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    estimatedMinutes: row.estimatedMinutes,
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

  async listCourses(query: CourseQuery, actorRoles: string[] = [], actorId?: string) {
    const { page, perPage, search, isPublished, educationLevel } = query;
    const isStudent = !actorRoles.includes('SUPER_ADMIN') && !actorRoles.includes('TEACHER');

    // STUDENT faqat o'z FAOL guruhiga biriktirilgan kurslarnigina ko'radi (L9).
    let studentGroupId: string | null = null;
    if (isStudent && actorId) {
      const member = await this.prisma.groupMember.findUnique({
        where: { studentId: actorId },
        select: { groupId: true, group: { select: { isActive: true } } },
      });
      studentGroupId = member && member.group.isActive ? member.groupId : null;
    }

    // N3: TEACHER faqat o'z + LIBRARY ko'radi
    const isSA = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSA;

    const where: Prisma.CourseWhereInput = {
      ...(isStudent
        ? {
            isPublished: true,
            ...(studentGroupId
              ? { groups: { some: { groupId: studentGroupId } } }
              : // Guruhsiz talaba hech qanday kurs ko'rmasligi uchun imkonsiz shart.
                { id: '00000000-0000-0000-0000-000000000000' }),
          }
        : isPublished !== undefined
          ? { isPublished }
          : {}),
      ...(isTeacher && actorId
        ? {
            OR: [{ ownerId: actorId }, { visibility: 'LIBRARY' as const }],
          }
        : {}),
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

  async findCourseBySlug(
    slug: string,
    actorRoles: string[] = [],
    actorId?: string,
  ): Promise<CourseDto> {
    const row = await this.prisma.course.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { ...COURSE_SELECT, id: true },
    });
    if (!row) throw new NotFoundException('Kurs topilmadi');
    const isSA = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSA;
    const isStudent = !isSA && !isTeacher;
    if (isTeacher && row.ownerId !== actorId && row.visibility !== 'LIBRARY') {
      throw new NotFoundException('Kurs topilmadi');
    }
    if (isStudent) {
      if (!row.isPublished) throw new NotFoundException('Kurs topilmadi');
      await this.assertStudentCanSeeCourse(row.id, actorId);
    }
    return toCourseDto(row);
  }

  async findCourseById(
    id: string,
    actorRoles: string[] = [],
    actorId?: string,
  ): Promise<CourseDto> {
    const row = await this.prisma.course.findUnique({ where: { id }, select: COURSE_SELECT });
    if (!row) throw new NotFoundException('Kurs topilmadi');
    const isSA = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSA;
    const isStudent = !isSA && !isTeacher;
    if (isTeacher && row.ownerId !== actorId && row.visibility !== 'LIBRARY') {
      throw new NotFoundException('Kurs topilmadi');
    }
    if (isStudent) {
      if (!row.isPublished) throw new NotFoundException('Kurs topilmadi');
      await this.assertStudentCanSeeCourse(id, actorId);
    }
    return toCourseDto(row);
  }

  private async assertEducationLevelExists(slug: string): Promise<void> {
    const row = await this.prisma.educationLevelItem.findUnique({ where: { slug } });
    if (!row) {
      throw new ConflictException(`"${slug}" nomli ta'lim darajasi mavjud emas`);
    }
  }

  private async assertStudentCanSeeCourse(courseId: string, actorId?: string): Promise<void> {
    if (!actorId) throw new NotFoundException('Kurs topilmadi');
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId: actorId },
      select: { groupId: true, group: { select: { isActive: true } } },
    });
    // L9: faqat FAOL guruh talabasi kontent ko'radi.
    if (!member || !member.group.isActive) throw new NotFoundException('Kurs topilmadi');
    const link = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId, groupId: member.groupId } },
      select: { courseId: true },
    });
    if (!link) throw new NotFoundException('Kurs topilmadi');
  }

  async createCourse(dto: CreateCourseInput, ctx: RequestContext): Promise<CourseDto> {
    const slug = dto.slug.trim().toLowerCase();
    const clash = await this.prisma.course.findUnique({ where: { slug } });
    if (clash) throw new ConflictException('Bu slug bilan kurs allaqachon mavjud');

    await this.assertEducationLevelExists(dto.educationLevel);

    const row = await this.prisma.course.create({
      data: {
        id: uuidv7(),
        slug,
        nameUz: dto.nameUz.trim(),
        descriptionUz: dto.descriptionUz?.trim() ?? null,
        educationLevel: dto.educationLevel,
        isPublished: dto.isPublished ?? false,
        visibility: dto.visibility ?? 'PRIVATE',
        // 3-rol LMS: kurs egasi = yaratgan user (TEACHER o'ziniki; SA uchun ham egalik beriladi).
        ownerId: ctx.actorId ?? null,
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

  async updateCourse(
    id: string,
    dto: UpdateCourseInput,
    ctx: RequestContext,
    actorRoles: string[] = [],
  ): Promise<CourseDto> {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kurs topilmadi');

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && existing.ownerId !== ctx.actorId) {
      throw new ForbiddenException('Faqat o‘z kursingizni tahrirlashingiz mumkin');
    }

    let slug: string | undefined;
    if (dto.slug !== undefined) {
      slug = dto.slug.trim().toLowerCase();
      const clash = await this.prisma.course.findFirst({ where: { slug, NOT: { id } } });
      if (clash) throw new ConflictException('Bu slug bilan kurs allaqachon mavjud');
    }

    if (dto.educationLevel !== undefined) {
      await this.assertEducationLevelExists(dto.educationLevel);
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
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
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

  /**
   * L4: kursni "nusxa olish" — ownerId=actor, visibility=PRIVATE, slug="orig-copy".
   * Darslar, modullar, materiallar nusxalanadi. Testlar — alohida (ownership).
   */
  async cloneCourse(sourceId: string, ctx: RequestContext, actorRoles: string[] = []): Promise<CourseDto> {
    const src = await this.prisma.course.findUnique({
      where: { id: sourceId },
      include: {
        lessons: true,
        modules: true,
        materials: true,
      },
    });
    if (!src) throw new NotFoundException('Kurs topilmadi');

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    const isOwner = src.ownerId === ctx.actorId;
    const isLibrary = src.visibility === 'LIBRARY';
    if (!isSuperAdmin && !isOwner && !isLibrary) {
      throw new ForbiddenException("Faqat o'z yoki kutubxona kursini nusxalashingiz mumkin");
    }

    // slug unikal: "orig-copy", "orig-copy-2", ...
    const base = `${src.slug}-copy`;
    let slug = base;
    for (let i = 2; ; i++) {
      const clash = await this.prisma.course.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${base}-${i}`;
      if (i > 100) throw new ConflictException('Nusxalash uchun slug topilmadi');
    }

    const newCourseId = uuidv7();
    const moduleIdMap = new Map<string, string>();
    const lessonIdMap = new Map<string, string>();

    const newCourse = await this.prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          id: newCourseId,
          slug,
          nameUz: `${src.nameUz} (nusxa)`,
          descriptionUz: src.descriptionUz,
          educationLevel: src.educationLevel,
          isPublished: false,
          visibility: 'PRIVATE',
          ownerId: ctx.actorId ?? null,
        },
        select: COURSE_SELECT,
      });

      // Modullar
      for (const m of src.modules) {
        const newId = uuidv7();
        moduleIdMap.set(m.id, newId);
        await tx.module.create({
          data: {
            id: newId,
            courseId: newCourseId,
            orderIndex: m.orderIndex,
            titleUz: m.titleUz,
            descriptionUz: m.descriptionUz,
            isPublished: m.isPublished,
          },
        });
      }
      // Darslar
      for (const l of src.lessons) {
        const newId = uuidv7();
        lessonIdMap.set(l.id, newId);
        await tx.lesson.create({
          data: {
            id: newId,
            courseId: newCourseId,
            moduleId: l.moduleId ? (moduleIdMap.get(l.moduleId) ?? null) : null,
            orderIndex: l.orderIndex,
            lessonType: l.lessonType,
            titleUz: l.titleUz,
            objectiveUz: l.objectiveUz,
            equipmentUz: l.equipmentUz,
            theoryUz: l.theoryUz,
            procedureUz: l.procedureUz as Prisma.InputJsonValue,
            isPublished: l.isPublished,
            estimatedMinutes: l.estimatedMinutes,
          },
        });
      }
      // Materiallar — storageKey yangi obyektga nusxalash o'rniga reference qolsa oson.
      // Hozircha metadata nusxalaymiz (fayl o'zi bir xil manzilda qoladi).
      for (const mat of src.materials) {
        await tx.courseMaterial.create({
          data: {
            id: uuidv7(),
            courseId: newCourseId,
            lessonId: mat.lessonId ? (lessonIdMap.get(mat.lessonId) ?? null) : null,
            fileName: mat.fileName,
            storageKey: `${mat.storageKey}#copy-${newCourseId}`,
            mimeType: mat.mimeType,
            sizeBytes: mat.sizeBytes,
            uploadedBy: ctx.actorId ?? null,
            contentText: mat.contentText,
          },
        });
      }

      return created;
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'Course',
      subjectId: newCourse.id,
      changes: { clonedFrom: sourceId } as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toCourseDto(newCourse);
  }

  async removeCourse(id: string, ctx: RequestContext, actorRoles: string[] = []) {
    const existing = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true } } },
    });
    if (!existing) throw new NotFoundException('Kurs topilmadi');

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && existing.ownerId !== ctx.actorId) {
      throw new ForbiddenException('Faqat o‘z kursingizni o‘chira olasiz');
    }

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

  async listLessons(query: LessonQuery, actorRoles: string[] = [], actorId?: string) {
    const { page, perPage, search, courseId, lessonType } = query;
    const isSA = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSA;
    const isStudent = !isSA && !isTeacher;

    // STUDENT uchun ko'rinadigan dars where filtri
    let studentCourseIds: string[] | null = null;
    if (isStudent) {
      studentCourseIds = await this.listStudentVisibleCourseIds(actorId);
      if (studentCourseIds.length === 0) {
        return { data: [], meta: { page, perPage, total: 0, totalPages: 1 } };
      }
    }

    // N3: TEACHER faqat o'z kurs/LIBRARY darslarini ko'radi
    const teacherCourseFilter: Prisma.LessonWhereInput = isTeacher && actorId
      ? { course: { OR: [{ ownerId: actorId }, { visibility: 'LIBRARY' as const }] } }
      : {};

    const where: Prisma.LessonWhereInput = {
      ...(courseId ? { courseId } : {}),
      ...(lessonType ? { lessonType } : {}),
      ...(search
        ? { titleUz: { contains: search, mode: 'insensitive' as const } }
        : {}),
      ...(studentCourseIds ? { courseId: { in: studentCourseIds } } : {}),
      ...teacherCourseFilter,
      // STUDENT: faqat PUBLISHED va arxivlanmagan darslar
      ...(isStudent ? { isPublished: true, archivedAt: null } : {}),
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

    // N4: STUDENT uchun qulflangan darslar matnini olib tashlaymiz.
    const data =
      isStudent && actorId
        ? await this.stripLockedLessonBodies(rows, actorId)
        : rows.map(toLessonDto);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async listLessonsByCourse(
    courseId: string,
    actorRoles: string[] = [],
    actorId?: string,
  ): Promise<LessonDto[]> {
    const isSA = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSA;
    const isStudent = !isSA && !isTeacher;

    // N3: TEACHER PRIVATE begona kurs darslarini ko'rolmaydi
    if (isTeacher) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { ownerId: true, visibility: true },
      });
      if (!course) throw new NotFoundException('Kurs topilmadi');
      if (course.ownerId !== actorId && course.visibility !== 'LIBRARY') {
        throw new NotFoundException('Kurs topilmadi');
      }
    }
    if (isStudent) {
      await this.assertStudentCanSeeCourse(courseId, actorId);
    }
    const rows = await this.prisma.lesson.findMany({
      where: {
        courseId,
        ...(isStudent ? { isPublished: true, archivedAt: null } : {}),
      },
      select: LESSON_SELECT,
      orderBy: { orderIndex: 'asc' },
    });

    // N4: STUDENT uchun qulflangan (release LOCKED yoki opensAt kelmagan) darslarning
    // nazariya/amaliyot matnlarini olib tashlaymiz, faqat qisqa ma'lumot qoladi.
    if (isStudent && actorId) {
      return this.stripLockedLessonBodies(rows, actorId);
    }
    return rows.map(toLessonDto);
  }

  /**
   * N4: Yopiq darslarning kontentini olib tashlab, faqat `{id, titleUz, orderIndex,
   * locked: true, opensAt}` qoldiradi (JSON tipida).
   */
  private async stripLockedLessonBodies(
    rows: LessonRow[],
    studentId: string,
  ): Promise<LessonDto[]> {
    if (rows.length === 0) return [];
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId },
      select: { groupId: true },
    });
    if (!member) return rows.map(toLessonDto);

    const releases = await this.prisma.groupLessonRelease.findMany({
      where: { groupId: member.groupId },
    });
    const byLesson = new Map(releases.filter((r) => r.lessonId).map((r) => [r.lessonId!, r]));
    const byModule = new Map(releases.filter((r) => r.moduleId).map((r) => [r.moduleId!, r]));

    return rows.map((row) => {
      const direct = byLesson.get(row.id);
      const parent = row.moduleId ? byModule.get(row.moduleId) : undefined;
      const rel = direct ?? parent;
      if (!rel || this.isReleaseOpenNow(rel)) return toLessonDto(row);
      // Yopiq — matnni kesib tashlaymiz.
      return {
        ...toLessonDto(row),
        objectiveUz: null,
        equipmentUz: null,
        theoryUz: null,
        procedureUz: [],
      };
    });
  }

  async findLessonById(
    id: string,
    actorRoles: string[] = [],
    actorId?: string,
  ): Promise<LessonWithCourseDto> {
    const row = await this.prisma.lesson.findUnique({
      where: { id },
      select: {
        ...LESSON_SELECT,
        course: {
          select: {
            id: true,
            slug: true,
            nameUz: true,
            isPublished: true,
            ownerId: true,
            visibility: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Dars topilmadi');
    const isSA = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSA;
    const isStudent = !isSA && !isTeacher;
    if (isTeacher) {
      if (row.course.ownerId !== actorId && row.course.visibility !== 'LIBRARY') {
        throw new NotFoundException('Dars topilmadi');
      }
    }
    if (isStudent) {
      if (!row.course.isPublished) throw new NotFoundException('Dars topilmadi');
      if (!row.isPublished || row.archivedAt) throw new NotFoundException('Dars topilmadi');
      await this.assertStudentCanSeeCourse(row.course.id, actorId);
      // F3 (2.A): dars talaba guruhida ochilgan bo'lishi kerak
      await this.assertStudentCanAccessLesson(id, actorId);
    }
    const { isPublished: _ignored1, ownerId: _ignored2, visibility: _ignored3, ...course } = row.course;
    void _ignored1;
    void _ignored2;
    void _ignored3;
    return { ...toLessonDto(row), course };
  }

  /**
   * F3 (2.A): talaba darsni ko'rishi uchun GroupLessonRelease OPEN bo'lishi
   * yoki opensAt <= now bo'lishi, SCHEDULED bo'lsa. LOCKED — 404.
   * Dars uchun release yo'q bo'lsa — modul darajasida qidiramiz.
   * Hech biri bo'lmasa — dars DEFAULT ochiq (asosiy oqim).
   */
  private async assertStudentCanAccessLesson(lessonId: string, actorId?: string): Promise<void> {
    if (!actorId) throw new NotFoundException('Dars topilmadi');
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId: actorId },
      select: { groupId: true },
    });
    if (!member) throw new NotFoundException('Dars topilmadi');
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { moduleId: true },
    });
    // Dars uchun release
    const lessonRelease = await this.prisma.groupLessonRelease.findFirst({
      where: { groupId: member.groupId, lessonId },
    });
    if (lessonRelease) {
      if (this.isReleaseOpenNow(lessonRelease)) return;
      throw new NotFoundException('Dars hali ochilmagan');
    }
    // Modul uchun release
    if (lesson?.moduleId) {
      const moduleRelease = await this.prisma.groupLessonRelease.findFirst({
        where: { groupId: member.groupId, moduleId: lesson.moduleId },
      });
      if (moduleRelease) {
        if (this.isReleaseOpenNow(moduleRelease)) return;
        throw new NotFoundException('Dars hali ochilmagan');
      }
    }
    // Release yo'q — ochiq, standart oqim
  }

  /**
   * N12: `LOCKED` doim yopiq. `SCHEDULED` — opensAt kelmaguncha yopiq;
   * closesAt o'tgandan keyin yopiq. `OPEN` — closesAt o'tgandan keyin yopiq.
   */
  private isReleaseOpenNow(release: {
    status: 'LOCKED' | 'SCHEDULED' | 'OPEN';
    opensAt: Date | null;
    closesAt: Date | null;
  }): boolean {
    if (release.status === 'LOCKED') return false;
    const now = Date.now();
    if (release.closesAt && release.closesAt.getTime() < now) return false;
    if (release.status === 'OPEN') return true;
    // SCHEDULED
    if (!release.opensAt || release.opensAt.getTime() > now) return false;
    return true;
  }

  /**
   * Talaba ko'rishi mumkin bo'lgan kurs id'lari ro'yxatini qaytaradi:
   *  - talaba FAQAT bitta guruhda bo'ladi (GroupMember.studentId @unique)
   *  - guruh faol bo'lishi kerak (L9: nofaol guruh talabasi hech narsa ko'rmaydi)
   *  - CourseGroup orqali biriktirilgan va isPublished=true kurslar
   */
  private async listStudentVisibleCourseIds(studentId?: string): Promise<string[]> {
    if (!studentId) return [];
    const member = await this.prisma.groupMember.findUnique({
      where: { studentId },
      select: { group: { select: { id: true, isActive: true } } },
    });
    if (!member || !member.group.isActive) return [];
    const links = await this.prisma.courseGroup.findMany({
      where: { groupId: member.group.id, course: { isPublished: true } },
      select: { courseId: true },
    });
    return links.map((l) => l.courseId);
  }

  async createLesson(
    dto: CreateLessonInput,
    ctx: RequestContext,
    actorRoles: string[] = [],
  ): Promise<LessonDto> {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Kurs topilmadi');

    // Egalik: faqat SA yoki kurs egasi dars qo'sha oladi
    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && course.ownerId !== ctx.actorId) {
      throw new ForbiddenException('Faqat o‘z kursingizga dars qo‘sha olasiz');
    }

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
        moduleId: dto.moduleId ?? null,
        orderIndex: dto.orderIndex,
        lessonType: dto.lessonType,
        titleUz: dto.titleUz.trim(),
        objectiveUz: dto.objectiveUz?.trim() ?? null,
        equipmentUz: dto.equipmentUz?.trim() ?? null,
        theoryUz: dto.theoryUz?.trim() ?? null,
        procedureUz: (dto.procedureUz ?? []) as Prisma.InputJsonValue,
        isPublished: dto.isPublished ?? true,
        estimatedMinutes: dto.estimatedMinutes ?? null,
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

    // Faqat PUBLISHED kurs darslari uchun bildirishnoma — qoralama darslari tinch tursin
    if (course.isPublished) {
      const assignedGroups = await this.prisma.courseGroup.findMany({
        where: { courseId: course.id },
        select: { groupId: true },
      });
      const groupIds = assignedGroups.map((g) => g.groupId);
      if (groupIds.length > 0) {
        const members = await this.prisma.groupMember.findMany({
          where: { groupId: { in: groupIds } },
          select: { studentId: true },
        });
        if (members.length > 0) {
          await this.notifications.notifyUsers(
            members.map((m) => m.studentId),
            {
              type: 'LESSON_CREATED',
              titleUz: 'Yangi dars qo‘shildi',
              bodyUz: `"${course.nameUz}" kursida: ${row.titleUz}`,
              data: { lessonId: row.id, courseId: course.id, courseSlug: course.slug },
            },
          );
        }
      }
    }

    return toLessonDto(row);
  }

  async updateLesson(
    id: string,
    dto: UpdateLessonInput,
    ctx: RequestContext,
    actorRoles: string[] = [],
  ): Promise<LessonDto> {
    const existing = await this.prisma.lesson.findUnique({
      where: { id },
      include: { course: { select: { ownerId: true } } },
    });
    if (!existing) throw new NotFoundException('Dars topilmadi');

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && existing.course.ownerId !== ctx.actorId) {
      throw new ForbiddenException('Faqat o‘z kursingiz darslarini tahrir qila olasiz');
    }

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
        ...(dto.moduleId !== undefined ? { moduleId: dto.moduleId ?? null } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.estimatedMinutes !== undefined ? { estimatedMinutes: dto.estimatedMinutes ?? null } : {}),
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

  /**
   * L11: darsni o'chirish ta'sir hisobotini qaytaradi (talaba progressi,
   * biriktirilgan topshiriqlar va testlar soni). Haqiqiy o'chirish uchun
   * removeLesson() chaqiring. UI shu hisobotni ko'rsatib tasdiqlashi kerak.
   */
  async lessonRemovalImpact(
    id: string,
    actorRoles: string[] = [],
    actorId?: string,
  ): Promise<{
    lessonId: string;
    completedProgressCount: number;
    assignmentCount: number;
    quizCount: number;
    materialCount: number;
  }> {
    // N3: faqat kurs egasi yoki SA
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { course: { select: { ownerId: true } } },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const isSA = actorRoles.includes('SUPER_ADMIN');
    if (!isSA && lesson.course.ownerId !== actorId) {
      throw new NotFoundException('Dars topilmadi');
    }
    const [completed, assignments, quizzes, materials] = await this.prisma.$transaction([
      this.prisma.lessonProgress.count({
        where: { lessonId: id, completedAt: { not: null } },
      }),
      this.prisma.assignment.count({ where: { lessonId: id } }),
      this.prisma.quiz.count({ where: { lessonId: id } }),
      this.prisma.courseMaterial.count({ where: { lessonId: id } }),
    ]);
    return {
      lessonId: id,
      completedProgressCount: completed,
      assignmentCount: assignments,
      quizCount: quizzes,
      materialCount: materials,
    };
  }

  /**
   * L11: darslarni qayta tartiblash — unikal constraint muammosini chetlab
   * o'tish uchun bitta tranzaksiyada vaqtincha salbiy indekslarga ko'chirib,
   * so'ngra yakuniy indekslarga qo'yadi.
   */
  async reorderLessons(
    courseId: string,
    lessonIds: string[],
    ctx: RequestContext,
    actorRoles: string[] = [],
  ): Promise<LessonDto[]> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    if (!course) throw new NotFoundException('Kurs topilmadi');
    const isSA = actorRoles.includes('SUPER_ADMIN');
    if (!isSA && course.ownerId !== ctx.actorId) {
      throw new ForbiddenException("Faqat o'z kursingiz darslarini qayta tartiblashingiz mumkin");
    }
    const allLessons = await this.prisma.lesson.findMany({
      where: { courseId },
      select: { id: true },
    });
    const providedSet = new Set(lessonIds);
    const existingSet = new Set(allLessons.map((l) => l.id));
    // N18: barcha darslar ro'yxatda bo'lishi kerak (to'liq)
    if (lessonIds.length !== allLessons.length) {
      throw new BadRequestException(
        `Kursda ${allLessons.length} ta dars bor, lekin ${lessonIds.length} ta ID yuborildi`,
      );
    }
    for (const id of lessonIds) {
      if (!existingSet.has(id)) {
        throw new BadRequestException(`Dars shu kursga tegishli emas: ${id}`);
      }
    }
    if (providedSet.size !== lessonIds.length) {
      throw new BadRequestException('Takroriy ID lar');
    }
    await this.prisma.$transaction(async (tx) => {
      // Vaqtincha salbiy indekslarga ko'chirish (unikal cheklov buzilmasin uchun)
      for (let i = 0; i < lessonIds.length; i++) {
        await tx.lesson.update({
          where: { id: lessonIds[i] },
          data: { orderIndex: -(i + 1) },
        });
      }
      // Yakuniy indekslar
      for (let i = 0; i < lessonIds.length; i++) {
        await tx.lesson.update({
          where: { id: lessonIds[i] },
          data: { orderIndex: i },
        });
      }
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'Course',
      subjectId: courseId,
      changes: { reorder: lessonIds } as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const rows = await this.prisma.lesson.findMany({
      where: { courseId },
      select: LESSON_SELECT,
      orderBy: { orderIndex: 'asc' },
    });
    return rows.map(toLessonDto);
  }

  async removeLesson(id: string, ctx: RequestContext, actorRoles: string[] = [], hardDelete = false) {
    const existing = await this.prisma.lesson.findUnique({
      where: { id },
      include: { course: { select: { ownerId: true } } },
    });
    if (!existing) throw new NotFoundException('Dars topilmadi');

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && existing.course.ownerId !== ctx.actorId) {
      throw new ForbiddenException('Faqat o‘z kursingiz darslarini o‘chira olasiz');
    }

    // L11: default — soft-delete (archivedAt). Haqiqiy o'chirish uchun ?hard=true.
    if (!hardDelete) {
      await this.prisma.lesson.update({
        where: { id },
        data: { archivedAt: new Date(), isPublished: false },
      });
      await this.audit.record({
        userId: ctx.actorId,
        action: AuditAction.UPDATE,
        subjectType: 'Lesson',
        subjectId: id,
        changes: { archived: true } as Prisma.InputJsonValue,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true, archived: true };
    }

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
