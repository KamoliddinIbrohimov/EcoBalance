import { z } from 'zod';
import { ROLE } from '../constants/roles';

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
