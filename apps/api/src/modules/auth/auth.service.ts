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

import type { ChangePasswordInput, UpdateProfileInput } from '@eco/shared';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { AuditService } from './services/audit.service';
import { PasswordService } from './services/password.service';
import { TokenService, type IssuedTokens } from './services/token.service';

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
    private readonly storage: StorageService,
  ) {}

  /**
   * NOTE: 3-rol LMS modelida ommaviy ro'yxatdan o'tish o'chirilgan.
   * Foydalanuvchini SUPER_ADMIN yoki TEACHER UsersService orqali yaratadi.
   * Bu metod kelajakda remova qilinishi mumkin — hozircha backward
   * compatibility uchun saqlangan, lekin controller'dan chaqirilmaydi.
   */
  async register(_dto: RegisterDto, _ctx: AuthContext): Promise<never> {
    throw new ConflictException(
      'Ommaviy ro‘yxatdan o‘tish o‘chirilgan. Administrator bilan bog‘laning.',
    );
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

    const user = await this.buildProfile(userId);
    return { accessToken, refreshToken, expiresIn, user };
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

  /**
   * Public logout: refresh cookie'dan foydalanuvchi ID'ni topib sessiyani bekor qiladi.
   * Auth guard talab qilmaydi — token eskirgan/yaroqsiz bo'lsa ham brauzer cookie'ni
   * tozalay olishi uchun 204 qaytaradi. Cookie yo'q bo'lsa hech nima qilmaydi.
   */
  async logoutByRefresh(rawRefreshToken: string | undefined, ctx: AuthContext) {
    if (!rawRefreshToken) return;
    const [familyId, raw] = rawRefreshToken.split('.', 2);
    if (!familyId || !raw) return;

    try {
      const record = await this.prisma.refreshToken.findFirst({
        where: { familyId },
        select: { userId: true },
      });

      await this.tokens.revokeByRaw(rawRefreshToken);

      if (record?.userId) {
        await this.audit.record({
          userId: record.userId,
          action: AuditAction.LOGOUT,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
      }
    } catch (err) {
      // Yaroqsiz/eskirgan cookie'lar uchun ham sekin fail — endpoint 204 qaytadi
      // va brauzer cookie'ni tozalaydi.
      this.logger.warn(`logoutByRefresh: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async me(userId: string) {
    return this.buildProfile(userId);
  }

  async updateProfile(userId: string, input: UpdateProfileInput, ctx: AuthContext) {
    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.firstName = input.firstName.trim();
    if (input.lastName !== undefined) patch.lastName = input.lastName.trim();
    if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
    if (input.locale !== undefined) patch.locale = input.locale;

    if (Object.keys(patch).length === 0) return this.buildProfile(userId);

    try {
      await this.prisma.user.update({ where: { id: userId }, data: patch });
    } catch (err) {
      // Unique constraint (phone) violation
      if (
        typeof err === 'object' &&
        err &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Bu telefon raqami boshqa foydalanuvchida band');
      }
      throw err;
    }

    await this.audit.record({
      userId,
      action: AuditAction.UPDATE,
      subjectType: 'User',
      subjectId: userId,
      changes: input as never,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.buildProfile(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined, ctx: AuthContext) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    const ALLOWED = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException(
        `Fayl turi qo‘llab-quvvatlanmaydi (${file.mimetype}). JPG, PNG, WEBP yoki GIF bo‘lishi kerak.`,
      );
    }
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) {
      throw new BadRequestException(
        `Rasm juda katta (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks: 5 MB.`,
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // Old avatar key — url'ning ohirgi qismi
    if (existing?.avatarUrl) {
      const oldKey = this.extractAvatarKey(existing.avatarUrl);
      if (oldKey) {
        try {
          await this.storage.delete(oldKey);
        } catch {
          // best-effort — keep going
        }
      }
    }

    const ext = file.mimetype.split('/')[1] ?? 'bin';
    const key = `avatars/${userId}/${uuidv7()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    // Public URL (presigned 7 days — TTL uzoq)
    const url = await this.storage.getDownloadUrl(key, `avatar.${ext}`, 7 * 24 * 60 * 60);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });

    await this.audit.record({
      userId,
      action: AuditAction.UPDATE,
      subjectType: 'User',
      subjectId: userId,
      changes: { avatarUrl: 'updated' } as never,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.buildProfile(userId);
  }

  async removeAvatar(userId: string, ctx: AuthContext) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (existing?.avatarUrl) {
      const key = this.extractAvatarKey(existing.avatarUrl);
      if (key) {
        try {
          await this.storage.delete(key);
        } catch {
          // best-effort
        }
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.audit.record({
      userId,
      action: AuditAction.UPDATE,
      subjectType: 'User',
      subjectId: userId,
      changes: { avatarUrl: 'removed' } as never,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return this.buildProfile(userId);
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    ctx: AuthContext,
    currentRefreshToken?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        roles: { include: { role: true } },
      },
    });
    if (!user) throw new UnauthorizedException();

    const ok = await this.passwords.verify(user.passwordHash, input.currentPassword);
    if (!ok) throw new UnauthorizedException('Joriy parol noto‘g‘ri');

    const sameAsOld = await this.passwords.verify(user.passwordHash, input.newPassword);
    if (sameAsOld) {
      throw new BadRequestException('Yangi parol eski parolga o‘xshamasligi kerak');
    }

    const newHash = await this.passwords.hash(input.newPassword);
    // Parol muvaffaqiyatli almashtirildi — mustChangePassword bayrog'ini
    // olib tashlaymiz (SA/TEACHER yaratgan vaqtincha paroldan keyin).
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    // B1: joriy refresh oilasini saqlab, qolgan sessiyalarni bekor qilamiz.
    // Shu tariqa parolni almashtirgan foydalanuvchi tizimda qoladi, boshqa
    // qurilma/tab'lari esa chiqarib tashlanadi. Yangi tokenlar qaytariladi,
    // kontroller ularni cookie va javobga qo'yadi.
    let issued: IssuedTokens | null = null;
    if (currentRefreshToken) {
      const [familyId] = currentRefreshToken.split('.', 1);
      if (familyId) {
        await this.tokens.revokeOtherFamiliesForUser(userId, familyId);
        const roles = user.roles.map((r) => r.role.slug);
        const perms = await this.prisma.rolePermission.findMany({
          where: { role: { users: { some: { userId } } } },
          include: { permission: true },
        });
        const permissionSlugs = Array.from(new Set(perms.map((p) => p.permission.slug)));
        // Eski oilani ham revoke qilib, yangi token juftligini chiqaramiz.
        await this.tokens.revokeFamily(familyId);
        issued = await this.tokens.issueTokens(userId, user.email, roles, permissionSlugs, {
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
      }
    }
    if (!issued) {
      // Refresh cookie yetkazilmagan — fallback xavfsiz yo'nalish:
      // barcha sessiyalarni bekor qilib, foydalanuvchini qayta kirishga yuboramiz.
      await this.tokens.revokeAllForUser(userId);
    }

    await this.audit.record({
      userId,
      action: AuditAction.PASSWORD_RESET_COMPLETE,
      subjectType: 'User',
      subjectId: userId,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true, tokens: issued };
  }

  private extractAvatarKey(url: string): string | null {
    // Presigned URL bo'lsa: `/ecobalance-private/avatars/.../file.jpg?X-Amz-...`
    // Path style: bucket'dan keyingi barcha yo'l.
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      // parts[0] = bucket, qolgani = key
      if (parts.length < 2) return null;
      return parts.slice(1).join('/');
    } catch {
      return null;
    }
  }

  private async buildProfile(userId: string) {
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
      /** Birinchi login'da parolni almashtirish talab qilinadi. */
      mustChangePassword: user.mustChangePassword,
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
    const profile = await this.buildProfile(userId);
    const tokens = await this.tokens.issueTokens(
      userId,
      email,
      profile.roles,
      profile.permissions,
      { ip: ctx.ip, userAgent: ctx.userAgent },
    );

    return { ...tokens, user: profile };
  }
}
