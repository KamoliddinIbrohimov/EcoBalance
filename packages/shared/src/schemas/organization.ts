import { z } from 'zod';
import { ORGANIZATION_TYPE } from '../constants/organizations';
import { paginationQuerySchema } from './pagination';

export const organizationSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  type: z.nativeEnum(ORGANIZATION_TYPE),
  nameUz: z.string(),
  code: z.string(),
  address: z.record(z.unknown()).nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationDto = z.infer<typeof organizationSchema>;

// ---------------------------------------------------------------
// Phase 1 — Organizations CRUD
// ---------------------------------------------------------------

/** Row shape returned by the admin Organizations list/detail/tree endpoints. */
export const adminOrganizationSchema = organizationSchema.extend({
  usersCount: z.number().int().nonnegative(),
  childrenCount: z.number().int().nonnegative(),
});
export type AdminOrganizationDto = z.infer<typeof adminOrganizationSchema>;

/** Recursive tree node — not validated via zod (server-built), just typed for reuse. */
export interface OrganizationTreeNode extends AdminOrganizationDto {
  children: OrganizationTreeNode[];
}

export const organizationQuerySchema = paginationQuerySchema.extend({
  type: z.nativeEnum(ORGANIZATION_TYPE).optional(),
  parentId: z.string().uuid().optional(),
});
export type OrganizationQuery = z.infer<typeof organizationQuerySchema>;

const orgCodeSchema = z
  .string()
  .min(2, 'Kamida 2 belgi')
  .max(60)
  .regex(
    /^[a-z0-9-]+$/,
    'Kod faqat kichik lotin harflari, raqam va tire (-) dan iborat bo‘lishi kerak',
  );

export const createOrganizationSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: z.nativeEnum(ORGANIZATION_TYPE),
  nameUz: z.string().min(2, 'Kamida 2 belgi').max(255),
  code: orgCodeSchema,
  address: z.record(z.unknown()).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: z.nativeEnum(ORGANIZATION_TYPE).optional(),
  nameUz: z.string().min(2, 'Kamida 2 belgi').max(255).optional(),
  code: orgCodeSchema.optional(),
  address: z.record(z.unknown()).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
