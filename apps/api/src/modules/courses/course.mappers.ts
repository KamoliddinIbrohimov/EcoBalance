import type { CourseMaterial, Prisma } from '@prisma/client';
import type { CourseDto, LessonDto, ModuleDto } from '@eco/shared';

export const COURSE_SELECT = {
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

export type CourseRow = Prisma.CourseGetPayload<{ select: typeof COURSE_SELECT }>;

export function toCourseDto(row: CourseRow, lessonsCount = row._count.lessons): CourseDto {
  const { _count, createdAt, updatedAt, ...rest } = row;
  return {
    ...rest,
    lessonsCount,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export const LESSON_SELECT = {
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

export type LessonRow = Prisma.LessonGetPayload<{ select: typeof LESSON_SELECT }>;

export function toLessonDto(row: LessonRow): LessonDto {
  // procedureUz JSONB — eski yozuvlarda massiv bo'lmasligi yoki aralash bo'lishi mumkin.
  const procedure = Array.isArray(row.procedureUz)
    ? row.procedureUz.filter((v): v is string => typeof v === 'string')
    : [];
  return {
    ...row,
    procedureUz: procedure,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Yopiq (release ochilmagan) dars: sarlavha qoladi, mazmun kesiladi. */
export function stripLessonBody(dto: LessonDto): LessonDto {
  return { ...dto, objectiveUz: null, equipmentUz: null, theoryUz: null, procedureUz: [] };
}

export const MODULE_SELECT = {
  id: true,
  courseId: true,
  orderIndex: true,
  titleUz: true,
  descriptionUz: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModuleSelect;

export type ModuleRow = Prisma.ModuleGetPayload<{ select: typeof MODULE_SELECT }>;

export function toModuleDto(row: ModuleRow): ModuleDto {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export interface MaterialDto {
  id: string;
  courseId: string;
  lessonId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export function toMaterialDto(r: CourseMaterial): MaterialDto {
  return {
    id: r.id,
    courseId: r.courseId,
    lessonId: r.lessonId,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    uploadedBy: r.uploadedBy,
    createdAt: r.createdAt.toISOString(),
  };
}
