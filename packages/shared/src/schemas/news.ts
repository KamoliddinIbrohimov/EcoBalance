import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

export const newsSchema = z.object({
  id: z.string().uuid(),
  titleUz: z.string(),
  bodyUz: z.string(),
  attachmentUrl: z.string().nullable(),
  attachmentFileName: z.string().nullable(),
  attachmentMimeType: z.string().nullable(),
  attachmentSizeBytes: z.number().int().nullable(),
  isPublished: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  authorName: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NewsDto = z.infer<typeof newsSchema>;

// multipart/form-data yuborilganda barcha maydonlar string bo'lib keladi.
// z.coerce.boolean() "true"/"false" satrini boolean'ga aylantiradi (bo'sh string
// ham false bo'ladi). JSON yuborilsa ham normal boolean sifatida qabul qilinadi.
const boolCoerce = z.preprocess(
  (v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : v),
  z.boolean(),
);

export const createNewsSchema = z.object({
  titleUz: z.string().min(3, 'Kamida 3 belgi').max(255),
  bodyUz: z.string().min(3, 'Kamida 3 belgi').max(20000),
  isPublished: boolCoerce.default(false),
});
export type CreateNewsInput = z.infer<typeof createNewsSchema>;

export const updateNewsSchema = z.object({
  titleUz: z.string().min(3).max(255).optional(),
  bodyUz: z.string().min(3).max(20000).optional(),
  isPublished: boolCoerce.optional(),
  /** true bo'lsa — biriktirilgan faylni o'chiradi. */
  removeAttachment: boolCoerce.optional(),
});
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;

export const newsQuerySchema = paginationQuerySchema.extend({
  isPublished: z.coerce.boolean().optional(),
});
export type NewsQuery = z.infer<typeof newsQuerySchema>;
