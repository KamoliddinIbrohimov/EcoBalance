import { z } from 'zod';

const uzPhone = z
  .string()
  .regex(/^\+998\d{9}$/, 'Telefon raqami +998XXXXXXXXX formatida bo‘lishi kerak')
  .optional();

export const passwordSchema = z
  .string()
  .min(10, 'Parol kamida 10 belgidan iborat bo‘lishi kerak')
  .max(128, 'Parol 128 belgidan oshmasligi kerak')
  .regex(/[A-Z]/, 'Parolda kamida bitta katta harf bo‘lishi kerak')
  .regex(/[a-z]/, 'Parolda kamida bitta kichik harf bo‘lishi kerak')
  .regex(/\d/, 'Parolda kamida bitta raqam bo‘lishi kerak');

export const loginSchema = z.object({
  email: z.string().email('To‘g‘ri email kiriting'),
  password: z.string().min(1, 'Parolni kiriting'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().min(2).max(100),
    lastName: z.string().min(2).max(100),
    email: z.string().email('To‘g‘ri email kiriting'),
    phone: uzPhone,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Parollar mos kelmayapti',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('To‘g‘ri email kiriting'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Parollar mos kelmayapti',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
