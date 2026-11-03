import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import {
  type ActorRequest,
  PASSWORD_CHANGE_KEY,
  PUBLIC_KEY,
  ROLES_KEY,
  primaryRole,
} from './actor';
import { TokenService } from './token.service';

/**
 * Yagona global guard: JWT → foydalanuvchi faolmi → vaqtinchalik parol →
 * rol. Rollar tokendan emas, DB'dan olinadi — bloklangan yoki roli
 * o'zgargan foydalanuvchi darhol ta'sirlanadi.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<ActorRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Avtorizatsiya talab qilinadi');

    const payload = await this.tokens.verifyAccess(header.slice(7));
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        mustChangePassword: true,
        roles: { select: { role: { select: { slug: true } } } },
      },
    });
    if (!user?.isActive) throw new UnauthorizedException('Foydalanuvchi faol emas');

    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(PASSWORD_CHANGE_KEY, targets)
    ) {
      throw new ForbiddenException('Avval parolingizni almashtirishingiz kerak');
    }

    const roles = user.roles.map((r) => r.role.slug as Role);
    req.actor = { id: user.id, email: user.email, roles, role: primaryRole(roles) };

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (allowed && !allowed.includes(req.actor.role)) {
      throw new ForbiddenException('Bu amal uchun ruxsat yo‘q');
    }
    return true;
  }
}
