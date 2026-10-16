export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABELS_UZ: Record<Role, string> = {
  SUPER_ADMIN: 'Bosh administrator',
  TEACHER: 'O‘qituvchi',
  STUDENT: 'O‘quvchi',
};

/** Dashboard panel accent (green/blue). Student va teacher yashil, super admin ko'k. */
export const ROLE_PANEL_THEME: Record<Role, 'green' | 'blue'> = {
  SUPER_ADMIN: 'blue',
  TEACHER: 'green',
  STUDENT: 'green',
};
