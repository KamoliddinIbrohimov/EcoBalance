import type { Role } from '@eco/shared';

/**
 * 3-rol LMS: har bir rol o'z home sahifasiga ega.
 *  SUPER_ADMIN → `/` (dashboard, tizim KPI)
 *  TEACHER     → `/teacher` (guruhlar, tekshirilmagan topshiriqlar)
 *  STUDENT     → `/home` (progress, deadline, oxirgi natijalar)
 */
export function getRoleHomePath(roles: Role[]): string {
  if (roles.includes('SUPER_ADMIN')) return '/';
  if (roles.includes('TEACHER')) return '/teacher';
  if (roles.includes('STUDENT')) return '/home';
  return '/home';
}
