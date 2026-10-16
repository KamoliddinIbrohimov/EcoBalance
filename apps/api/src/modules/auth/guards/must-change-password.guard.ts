import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../strategies/jwt-access.strategy';

const ALLOWED_PATHS = [
  '/api/v1/auth/me',
  '/api/v1/auth/me/change-password',
  '/api/v1/auth/logout',
];

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) return true;

    const path = req.path || req.url?.split('?')[0] || '';
    if (ALLOWED_PATHS.some((p) => path === p || path.endsWith(p))) return true;

    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { mustChangePassword: true },
    });
    if (row?.mustChangePassword) {
      throw new ForbiddenException(
        'Avval parolingizni almashtirishingiz kerak',
      );
    }
    return true;
  }
}
