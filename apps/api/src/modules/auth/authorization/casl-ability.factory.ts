import { Injectable } from '@nestjs/common';
import type { MongoAbility } from '@casl/ability';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';

/**
 * Actions/subjects are derived straight from the permission catalogue in
 * `@eco/shared` (format `<subject>.<action>`, e.g. "users.create"), so this
 * ability is intentionally string-typed rather than enumerating every
 * subject/action pair — new permissions "just work" without touching CASL
 * types every time a module adds one.
 */
export type AppAbility = MongoAbility<[string, string]>;

@Injectable()
export class CaslAbilityFactory {
  /**
   * Builds a CASL ability from the flat permission-slug list carried on the
   * JWT (see TokenService/AuthService). Each "<subject>.<action>" slug grants
   * `can(action, subject)`.
   */
  createForPermissions(permissions: string[]): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    for (const permission of permissions) {
      const separatorIndex = permission.indexOf('.');
      if (separatorIndex <= 0) continue;
      const subject = permission.slice(0, separatorIndex);
      const action = permission.slice(separatorIndex + 1);
      can(action, subject);
    }

    return build();
  }
}
