import { z } from 'zod';
import { ROLE } from '../constants/roles';
import { ORGANIZATION_TYPE } from '../constants/organizations';
import { paginationQuerySchema } from './pagination';
import { passwordSchema } from './auth';

export const userSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  locale: z.string(),
  isActive: z.boolean(),
  organizationId: z.string().uuid().nullable(),
  roles: z.array(z.nativeEnum(ROLE)),
  permissions: z.array(z.string()),
  emailVerifiedAt: z.string().datetime().nullable(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof userSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+998\d{9}$/, 'Telefon raqami +998XXXXXXXXX formatida bo‘lishi kerak')
    .nullable()
    .optional(),
  locale: z.enum(['uz', 'ru', 'en']).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(10)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/\d/),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Parollar mos kelmayapti',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------
// Phase 1 — admin-side Users CRUD
// ---------------------------------------------------------------

/** Row shape returned by the admin Users list/detail endpoints. */
export const adminUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  locale: z.string(),
  isActive: z.boolean(),
  organizationId: z.string().uuid().nullable(),
  organization: z
    .object({
      id: z.string().uuid(),
      nameUz: z.string(),
      type: z.nativeEnum(ORGANIZATION_TYPE),
    })
    .nullable(),
  roles: z.array(z.nativeEnum(ROLE)),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminUserDto = z.infer<typeof adminUserSchema>;

export const userQuerySchema = paginationQuerySchema.extend({
  organizationId: z.string().uuid().optional(),
  role: z.nativeEnum(ROLE).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type UserQuery = z.infer<typeof userQuerySchema>;

const uzPhoneOptional = z
  .string()
  .regex(/^\+998\d{9}$/, 'Telefon raqami +998XXXXXXXXX formatida bo‘lishi kerak')
  .nullable()
  .optional();

export const createUserSchema = z.object({
  firstName: z.string().min(2, 'Kamida 2 belgi').max(100),
  lastName: z.string().min(2, 'Kamida 2 belgi').max(100),
  email: z.string().email('To‘g‘ri email kiriting'),
  phone: uzPhoneOptional,
  password: passwordSchema,
  organizationId: z.string().uuid().nullable().optional(),
  roleSlugs: z.array(z.nativeEnum(ROLE)).min(1, 'Kamida bitta rol tanlang'),
  isActive: z.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().min(2, 'Kamida 2 belgi').max(100).optional(),
  lastName: z.string().min(2, 'Kamida 2 belgi').max(100).optional(),
  phone: uzPhoneOptional,
  organizationId: z.string().uuid().nullable().optional(),
  roleSlugs: z.array(z.nativeEnum(ROLE)).min(1, 'Kamida bitta rol tanlang').optional(),
  isActive: z.boolean().optional(),
  locale: z.enum(['uz', 'ru', 'en']).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
