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
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const ALL_PERMISSIONS = Object.values(PERMISSION);
