import type { Role } from '@eco/shared';

/**
 * Kirgandan keyin barcha rollar yangi bosh sahifaga (`/`) tushadi; rolga xos
 * panellar (`/teacher`, `/home`) bosh sahifadagi birinchi modul orqali ochiladi.
 */
export function getRoleHomePath(_roles: Role[]): string {
  return '/';
}
