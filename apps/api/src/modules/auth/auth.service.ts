import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, RoleSlug } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { AuditService } from './services/audit.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

export interface AuthContext {
  ip?: string;
  userAgent?: string;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ctx: AuthContext) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');
    }

    const citizenRole = await this.prisma.role.findUnique({ where: { slug: RoleSlug.CITIZEN } });
    if (!citizenRole) {
      throw new Error('CITIZEN role is not seeded — run `pnpm prisma db seed`');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const userId = uuidv7();

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phone: dto.phone ?? null,
        passwordHash,
        roles: { create: { roleId: citizenRole.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.record({
      userId: user.id,
      action: AuditAction.CREATE,
      subjectType: 'User',
      subjectId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.buildLoginResult(user.id, user.email, ctx);
  }

  async login(dto: LoginDto, ctx: AuthContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isActive: true,
      },
    });

    const failed = async () => {
      await this.audit.record({
        userId: user?.id ?? null,
        action: AuditAction.LOGIN_FAILED,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Email yoki parol noto‘g‘ri');
    };

    if (!user) return failed();
    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) return failed();
    if (!user.isActive) throw new UnauthorizedException('Foydalanuvchi bloklangan');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip?.slice(0, 45) },
    });

    await this.audit.record({
      userId: user.id,
      action: AuditAction.LOGIN,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.buildLoginResult(user.id, user.email, ctx);
  }

  async refresh(rawRefreshToken: string, ctx: AuthContext) {
    const { accessToken, refreshToken, expiresIn, userId } = await this.tokens.rotateRefresh(
      rawRefreshToken,
      ctx,
    );

    await this.audit.record({
      userId,
      action: AuditAction.TOKEN_REFRESH,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { accessToken, refreshToken, expiresIn };
  }

  async logout(userId: string, rawRefreshToken: string | undefined, ctx: AuthContext) {
    if (rawRefreshToken) await this.tokens.revokeByRaw(rawRefreshToken);
    await this.audit.record({
      userId,
      action: AuditAction.LOGOUT,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        organization: true,
      },
    });
    if (!user) throw new UnauthorizedException();

    const permissions = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { userId: user.id } } } },
      include: { permission: true },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      isActive: user.isActive,
      organizationId: user.organizationId,
      organization: user.organization
        ? {
            id: user.organization.id,
            type: user.organization.type,
            nameUz: user.organization.nameUz,
            code: user.organization.code,
          }
        : null,
      roles: user.roles.map((r) => r.role.slug),
      permissions: Array.from(new Set(permissions.map((p) => p.permission.slug))),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Always returns "ok" to prevent user enumeration.
   * Generates and stores a hashed token; the raw token would be emailed in Phase 2.
   */
  async forgotPassword(dto: ForgotPasswordDto, ctx: AuthContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const raw = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(raw).digest('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          id: uuidv7(),
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      await this.audit.record({
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_REQUEST,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      // TODO(phase-2): dispatch reset email with `raw` token via mail queue.
      this.logger.debug(`Password reset token (dev only): ${raw}`);
    }

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto, ctx: AuthContext) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Token noto‘g‘ri yoki muddati o‘tgan');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Nuke all sessions on password change.
    await this.tokens.revokeAllForUser(record.userId);

    await this.audit.record({
      userId: record.userId,
      action: AuditAction.PASSWORD_RESET_COMPLETE,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }

  private async buildLoginResult(userId: string, email: string, ctx: AuthContext) {
    const roleRows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const permissionRows = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { userId } } } },
      include: { permission: true },
    });
    const roles = roleRows.map((r) => r.role.slug);
    const permissions = Array.from(new Set(permissionRows.map((r) => r.permission.slug)));

    const tokens = await this.tokens.issueTokens(userId, email, roles, permissions, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ...tokens, roles, permissions };
  }
}
