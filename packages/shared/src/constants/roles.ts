export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CITY_ADMIN: 'CITY_ADMIN',
  MAHALLA_MANAGER: 'MAHALLA_MANAGER',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  CITIZEN: 'CITIZEN',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABELS_UZ: Record<Role, string> = {
  SUPER_ADMIN: 'Bosh administrator',
  ADMIN: 'Administrator',
  CITY_ADMIN: 'Shahar administratori',
  MAHALLA_MANAGER: 'Mahalla rahbari',
  TEACHER: 'O‘qituvchi',
  STUDENT: 'O‘quvchi',
  CITIZEN: 'Fuqaro',
};

/** Which visual theme each role uses in the dashboard (matches architecture screenshot) */
export const ROLE_PANEL_THEME: Record<Role, 'green' | 'blue' | 'purple'> = {
  SUPER_ADMIN: 'blue',
  ADMIN: 'blue',
  CITY_ADMIN: 'blue',
  MAHALLA_MANAGER: 'purple',
  TEACHER: 'green',
  STUDENT: 'green',
  CITIZEN: 'green',
};
