import { z } from 'zod';

/**
 * L18: `limit` legacy alias — endi schema'ga rasman qo'shilgan.
 * Konstruktor controller tomondan oddiy ko'rinishda:
 *   const effective = query.perPage ?? query.limit ?? 20;
 * Lekin standart sahifalash joylarida xizmatchi `.default(20)` ushlaydi.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  /** Legacy alias — perPage o'rniga ishlatilishi mumkin. */
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginatedMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginatedMeta = z.infer<typeof paginatedMetaSchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    meta: paginatedMetaSchema,
  });
