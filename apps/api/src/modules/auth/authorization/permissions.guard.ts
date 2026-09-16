import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '../strategies/jwt-access.strategy';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PERMISSIONS_KEY } from './permissions.decorator';

/**
 * Authorization guard (runs after the global JwtAuthGuard, which handles
 * authentication). Reads the `@RequirePermissions(...)` metadata on the
 * handler/class, builds a CASL ability from the current user's JWT
 * permissions, and checks every required permission against it.
 *
 * Routes with no `@RequirePermissions` decorator are allowed through
 * unchanged — this guard only *narrows* access, it never widens it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException();

    const ability = this.caslFactory.createForPermissions(user.permissions);

    const missing = required.filter((permission) => {
      const separatorIndex = permission.indexOf('.');
      const subject = permission.slice(0, separatorIndex);
      const action = permission.slice(separatorIndex + 1);
      return !ability.can(action, subject);
    });

    if (missing.length > 0) {
      throw new ForbiddenException(`Ushbu amal uchun ruxsat yo‘q: ${missing.join(', ')}`);
    }

    return true;
  }
}
