import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

export const LESSON_TYPE = {
  AMALIY: 'AMALIY',
  LABORATORIYA: 'LABORATORIYA',
  EKSKURSIYA: 'EKSKURSIYA',
} as const;
export type LessonType = (typeof LESSON_TYPE)[keyof typeof LESSON_TYPE];

export const LESSON_TYPE_LABELS_UZ: Record<LessonType, string> = {
  AMALIY: 'Amaliy mashg‘ulot',
  LABORATORIYA: 'Laboratoriya',
  EKSKURSIYA: 'Ekskursiya',
};

export const EDUCATION_LEVEL = {
  MAKTABGACHA: 'MAKTABGACHA',
  MAKTAB: 'MAKTAB',
  OLIY_TALIM: 'OLIY_TALIM',
  RESERVED: 'RESERVED',
} as const;
export type EducationLevel = (typeof EDUCATION_LEVEL)[keyof typeof EDUCATION_LEVEL];

export const EDUCATION_LEVEL_LABELS_UZ: Record<EducationLevel, string> = {
  MAKTABGACHA: 'Maktabgacha ta‘lim',
  MAKTAB: 'Maktab',
  OLIY_TALIM: 'Oliy ta‘lim',
  RESERVED: 'Boshqa',
};

export const EDUCATION_LEVEL_SLUGS: Record<EducationLevel, string> = {
  MAKTABGACHA: 'maktabgacha',
  MAKTAB: 'maktab',
  OLIY_TALIM: 'oliy',
  RESERVED: 'boshqa',
};

// ---------------------------------------------------------------
// Dynamic Education Level Items (CRUD by Super Admin)
// ---------------------------------------------------------------

export const educationLevelItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameUz: z.string(),
  descriptionUz: z.string().nullable(),
  iconName: z.string(),
  orderIndex: z.number().int(),
  linkedEnum: z.nativeEnum(EDUCATION_LEVEL).nullable(),
  isBuiltIn: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EducationLevelItemDto = z.infer<typeof educationLevelItemSchema>;

const slugField = z
  .string()
  .min(2, 'Kamida 2 belgi')
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Faqat kichik lotin harflari, raqam va tire');

export const createEducationLevelItemSchema = z.object({
  slug: slugField,
  nameUz: z.string().min(2).max(120),
  descriptionUz: z.string().max(500).nullable().optional(),
  iconName: z.string().min(1).max(60).default('GraduationCap'),
  orderIndex: z.coerce.number().int().min(0).max(9999).default(0),
  linkedEnum: z.nativeEnum(EDUCATION_LEVEL).nullable().optional(),
});
export type CreateEducationLevelItemInput = z.infer<typeof createEducationLevelItemSchema>;

export const updateEducationLevelItemSchema = z.object({
  nameUz: z.string().min(2).max(120).optional(),
  descriptionUz: z.string().max(500).nullable().optional(),
  iconName: z.string().min(1).max(60).optional(),
  orderIndex: z.coerce.number().int().min(0).max(9999).optional(),
  linkedEnum: z.nativeEnum(EDUCATION_LEVEL).nullable().optional(),
});
export type UpdateEducationLevelItemInput = z.infer<typeof updateEducationLevelItemSchema>;

// ---------------------------------------------------------------
// Course
// ---------------------------------------------------------------

/**
 * Kursning `educationLevel` maydoni — endi dinamik `education_level_items`
 * jadvalidagi `slug`ga havola qiladi (masalan: `maktabgacha-talim`, `kollej`).
 * Bu string bo'lishi bilan foydalanuvchi UI orqali istalgan yangi darajani
 * yaratib, kurslarni unga biriktira oladi. Bo'shatilgan yoki noma'lum slug —
 * UI'da "—" bilan ko'rinadi.
 */
const educationLevelSlugField = z
  .string()
  .min(2, 'Kamida 2 belgi')
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Faqat kichik lotin harflari, raqam va tire');

export const courseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameUz: z.string(),
  descriptionUz: z.string().nullable(),
  educationLevel: z.string(),
  isPublished: z.boolean(),
  lessonsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CourseDto = z.infer<typeof courseSchema>;

const courseSlugSchema = z
  .string()
  .min(2, 'Kamida 2 belgi')
  .max(80)
  .regex(
    /^[a-z0-9-]+$/,
    'Slug faqat kichik lotin harflari, raqam va tire (-) dan iborat bo‘lishi kerak',
  );

export const createCourseSchema = z.object({
  slug: courseSlugSchema,
  nameUz: z.string().min(2, 'Kamida 2 belgi').max(255),
  descriptionUz: z.string().max(4000).nullable().optional(),
  educationLevel: educationLevelSlugField,
  isPublished: z.boolean().default(false),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  slug: courseSlugSchema.optional(),
  nameUz: z.string().min(2).max(255).optional(),
  descriptionUz: z.string().max(4000).nullable().optional(),
  educationLevel: educationLevelSlugField.optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const courseQuerySchema = paginationQuerySchema.extend({
  isPublished: z.coerce.boolean().optional(),
  educationLevel: educationLevelSlugField.optional(),
});
export type CourseQuery = z.infer<typeof courseQuerySchema>;

// ---------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------

export const lessonSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  lessonType: z.nativeEnum(LESSON_TYPE),
  titleUz: z.string(),
  objectiveUz: z.string().nullable(),
  equipmentUz: z.string().nullable(),
  theoryUz: z.string().nullable(),
  procedureUz: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LessonDto = z.infer<typeof lessonSchema>;

export const lessonWithCourseSchema = lessonSchema.extend({
  course: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    nameUz: z.string(),
  }),
});
export type LessonWithCourseDto = z.infer<typeof lessonWithCourseSchema>;

export const createLessonSchema = z.object({
  courseId: z.string().uuid(),
  orderIndex: z.coerce.number().int().min(0).max(9999),
  lessonType: z.nativeEnum(LESSON_TYPE),
  titleUz: z.string().min(2).max(255),
  objectiveUz: z.string().max(2000).nullable().optional(),
  equipmentUz: z.string().max(2000).nullable().optional(),
  theoryUz: z.string().max(50_000).nullable().optional(),
  procedureUz: z.array(z.string().min(1).max(4000)).default([]),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = z.object({
  orderIndex: z.coerce.number().int().min(0).max(9999).optional(),
  lessonType: z.nativeEnum(LESSON_TYPE).optional(),
  titleUz: z.string().min(2).max(255).optional(),
  objectiveUz: z.string().max(2000).nullable().optional(),
  equipmentUz: z.string().max(2000).nullable().optional(),
  theoryUz: z.string().max(50_000).nullable().optional(),
  procedureUz: z.array(z.string().min(1).max(4000)).optional(),
});
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export const lessonQuerySchema = paginationQuerySchema.extend({
  courseId: z.string().uuid().optional(),
  lessonType: z.nativeEnum(LESSON_TYPE).optional(),
});
export type LessonQuery = z.infer<typeof lessonQuerySchema>;
