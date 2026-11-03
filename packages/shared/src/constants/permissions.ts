/**
 * Permission catalogue — the single source of truth used by both:
 *   • backend: seeder + CASL abilities
 *   • frontend: gate components ("Can I see this button?")
 *
 * Format: `<module>.<action>`. Modules match feature folders.
 */

export const PERMISSION = {
  // Users
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  // Organizations
  ORGS_READ: 'organizations.read',
  ORGS_CREATE: 'organizations.create',
  ORGS_UPDATE: 'organizations.update',
  ORGS_DELETE: 'organizations.delete',

  // Roles / permissions
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',

  // Audit
  AUDIT_READ: 'audit.read',

  // Notifications
  NOTIFICATIONS_READ_OWN: 'notifications.read.own',
  NOTIFICATIONS_MANAGE: 'notifications.manage',

  // Courses / lessons (Phase 5 — E-learning)
  COURSES_READ: 'courses.read',
  COURSES_CREATE: 'courses.create',
  COURSES_UPDATE: 'courses.update',
  COURSES_DELETE: 'courses.delete',
  LESSONS_MANAGE: 'lessons.manage',
  MATERIALS_MANAGE: 'materials.manage',

  // Eco Reports (Phase 4 — Environmental monitoring / EKO-PATRUL)
  ECO_REPORTS_CREATE: 'eco_reports.create',
  ECO_REPORTS_READ: 'eco_reports.read',
  ECO_REPORTS_MANAGE: 'eco_reports.manage',

  // News (nashr etilgan yangiliklar barchaga ko'rinadi; boshqarish — SUPER_ADMIN)
  NEWS_READ: 'news.read',
  NEWS_MANAGE: 'news.manage',

  // Quizzes / Tests (Phase 8 — ekologik manbalar bo'limiga biriktirilgan testlar)
  QUIZZES_TAKE: 'quizzes.take',
  QUIZZES_MANAGE: 'quizzes.manage',

  // LMS (Phase 9 — 3 rolli model)
  GROUPS_MANAGE: 'groups.manage',           // TEACHER o'z guruhlarini, SUPER_ADMIN hammasini
  ASSIGNMENTS_MANAGE: 'assignments.manage', // yaratish/baholash — TEACHER o'ziniki, SA hammasi
  ASSIGNMENTS_SUBMIT: 'assignments.submit', // STUDENT
  STATS_READ_OWN: 'stats.read.own',         // TEACHER/STUDENT o'ziniki
  STATS_READ_ALL: 'stats.read.all',         // SUPER_ADMIN
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const ALL_PERMISSIONS = Object.values(PERMISSION);

/**
 * Rol → ruxsatlar. Rollar qat'iy (3 ta), shuning uchun xarita kodda turadi:
 * API login/refresh javobida `permissions` shu yerdan hisoblanadi.
 */
export const ROLE_PERMISSIONS: Record<'SUPER_ADMIN' | 'TEACHER' | 'STUDENT', readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  TEACHER: [
    PERMISSION.USERS_READ,
    PERMISSION.USERS_CREATE,
    PERMISSION.USERS_UPDATE,
    PERMISSION.NOTIFICATIONS_READ_OWN,
    PERMISSION.COURSES_READ,
    PERMISSION.COURSES_CREATE,
    PERMISSION.COURSES_UPDATE,
    PERMISSION.LESSONS_MANAGE,
    PERMISSION.MATERIALS_MANAGE,
    PERMISSION.QUIZZES_TAKE,
    PERMISSION.QUIZZES_MANAGE,
    PERMISSION.GROUPS_MANAGE,
    PERMISSION.ASSIGNMENTS_MANAGE,
    PERMISSION.STATS_READ_OWN,
  ],
  STUDENT: [
    PERMISSION.NOTIFICATIONS_READ_OWN,
    PERMISSION.COURSES_READ,
    PERMISSION.QUIZZES_TAKE,
    PERMISSION.ASSIGNMENTS_SUBMIT,
    PERMISSION.STATS_READ_OWN,
  ],
};
