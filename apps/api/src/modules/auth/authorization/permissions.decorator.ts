import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@eco/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Marks a route (or a whole controller) as requiring the given permission
 * slugs, e.g. `@RequirePermissions(PERMISSION.USERS_CREATE)`. Enforced by
 * `PermissionsGuard`, which must also be applied via `@UseGuards`.
 *
 * Multiple permissions are combined with AND — the caller needs all of them.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
