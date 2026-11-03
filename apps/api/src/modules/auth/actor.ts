import type { ExecutionContext } from '@nestjs/common';
import { SetMetadata, createParamDecorator } from '@nestjs/common';
import type { Role } from '@eco/shared';
import type { Request } from 'express';

/** So'rov egasi — AuthGuard har so'rovda DB'dan to'ldiradi. */
export interface Actor {
  id: string;
  email: string;
  /** Asosiy rol: SUPER_ADMIN > TEACHER > STUDENT. */
  role: Role;
  roles: Role[];
}

export const isAdmin = (a: Actor) => a.role === 'SUPER_ADMIN';
export const isTeacher = (a: Actor) => a.role === 'TEACHER';
export const isStudent = (a: Actor) => a.role === 'STUDENT';

const ROLE_RANK: Role[] = ['SUPER_ADMIN', 'TEACHER', 'STUDENT'];
export function primaryRole(roles: Role[]): Role {
  return ROLE_RANK.find((r) => roles.includes(r)) ?? 'STUDENT';
}

export const PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const PASSWORD_CHANGE_KEY = 'auth:passwordChange';

/** Tokensiz ochiq endpoint. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Faqat shu rollarga ruxsat. Dekoratorsiz — har qanday kirgan foydalanuvchi. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Vaqtinchalik parol bilan ham ochiq (parolni almashtirish oqimi uchun). */
export const AllowWithTempPassword = () => SetMetadata(PASSWORD_CHANGE_KEY, true);

export type ActorRequest = Request & { actor?: Actor };

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  return ctx.switchToHttp().getRequest<ActorRequest>().actor!;
});

/** Audit uchun so'rov konteksti. */
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
});
