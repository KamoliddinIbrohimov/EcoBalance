import type { Role } from '@eco/shared';

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'CITY_ADMIN', 'TEACHER'];

export function getRoleHomePath(roles: Role[]): string {
  if (roles.some((r) => ADMIN_ROLES.includes(r))) return '/';
  if (roles.includes('MAHALLA_MANAGER')) return '/mahalla';
  return '/home';
}
