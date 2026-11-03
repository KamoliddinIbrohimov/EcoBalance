import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  ROLE_PERMISSIONS,
  type ResetPasswordInput,
  type Role,
  type UpdateProfileInput,
} from '@eco/shared';

import { AuditService } from '../../infra/audit.service';
import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import type { ClientInfo } from './actor';
import { PasswordService } from './password.service';
import { type TokenPair, TokenService } from './token.service';

const RESET_TTL_MS = 60 * 60 * 1000;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  locale: true,
  isActive: true,
  organizationId: true,
  organization: { select: { id: true, type: true, nameUz: true, code: true } },
  roles: { select: { role: { select: { slug: true } } } },
  emailVerifiedAt: true,
  lastLoginAt: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Rollar ro'yxati va ulardan kelib chiqadigan ruxsatlar. */
export function rolesAndPermissions(rows: { role: { slug: string } }[]) {
  const roles = rows.map((r) => r.role.slug as Role);
  const permissions = Array.from(new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r])));
  return { roles, permissions };
}

export type AuthResult = TokenPair & { user: Awaited<ReturnType<AuthService['profile']>> };

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

  async login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, passwordHash: true, isActive: true },
    });
    if (!user || !(await this.passwords.verify(user.passwordHash, input.password))) {
      await this.audit.record({ userId: user?.id, action: 'LOGIN_FAILED', ...client });
      throw new UnauthorizedException('Email yoki parol noto‘g‘ri');
    }
    if (!user.isActive) throw new UnauthorizedException('Foydalanuvchi bloklangan');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: client.ip?.slice(0, 45) },
    });
    await this.audit.record({ userId: user.id, action: 'LOGIN', ...client });
    return this.startSession(user.id, client);
  }

  async refresh(presented: string, client: ClientInfo): Promise<AuthResult> {
    const record = await this.tokens.ownerOf(presented);
    const user = await this.profile(record.userId);
    if (!user.isActive) {
      await this.tokens.revokeFamily(record.familyId);
      throw new UnauthorizedException('Foydalanuvchi bloklangan');
    }
    const pair = await this.tokens.rotate(record, this.payloadOf(user), client);
    return { ...pair, user };
  }

  async logout(presented: string | undefined, client: ClientInfo) {
    const userId = await this.tokens.revokeByToken(presented);
    if (userId) await this.audit.record({ userId, action: 'LOGOUT', ...client });
  }

  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!u) throw new UnauthorizedException();
    const { roles: roleRows, ...rest } = u;
    return {
      ...rest,
      ...rolesAndPermissions(roleRows),
      avatarUrl: await this.resolveAvatar(u.avatarUrl),
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput, client: ClientInfo) {
    const data = {
      firstName: input.firstName?.trim(),
      lastName: input.lastName?.trim(),
      phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
      locale: input.locale,
    };
    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Bu telefon raqami band');
      throw err;
    }
    await this.audit.record({
      userId,
      action: 'UPDATE',
      subjectType: 'User',
      subjectId: userId,
      changes: input,
      ...client,
    });
    return this.profile(userId);
  }

  async setAvatar(userId: string, file: Express.Multer.File | undefined, client: ClientInfo) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    if (!AVATAR_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Rasm JPG, PNG, WEBP yoki GIF bo‘lishi kerak');
    }
    await this.dropAvatarFile(userId);
    const key = `avatars/${userId}/${randomBytes(8).toString('hex')}.${file.mimetype.split('/')[1]}`;
    await this.storage.put(key, file.buffer, file.mimetype, 'public');
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: this.storage.publicUrl(key) },
    });
    await this.audit.record({ userId, action: 'UPDATE', subjectType: 'User', subjectId: userId, changes: { avatar: 'set' }, ...client });
    return this.profile(userId);
  }

  async removeAvatar(userId: string, client: ClientInfo) {
    await this.dropAvatarFile(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.audit.record({ userId, action: 'UPDATE', subjectType: 'User', subjectId: userId, changes: { avatar: 'removed' }, ...client });
    return this.profile(userId);
  }

  /**
   * Parolni almashtiradi. Joriy sessiya yangi token bilan davom etadi,
   * boshqa barcha qurilmalar chiqarib yuboriladi.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    presented: string | undefined,
    client: ClientInfo,
  ): Promise<TokenPair | null> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw new BadRequestException('Joriy parol noto‘g‘ri');
    }
    if (await this.passwords.verify(user.passwordHash, input.newPassword)) {
      throw new BadRequestException('Yangi parol eskisidan farq qilishi kerak');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword), mustChangePassword: false },
    });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.record({ userId, action: 'PASSWORD_RESET_COMPLETE', subjectType: 'User', subjectId: userId, ...client });

    // Cookie kelmagan bo'lsa (masalan boshqa domen) — qayta kirish kerak.
    if (!presented) return null;
    return this.tokens.issue(this.payloadOf(await this.profile(userId)), client);
  }

  /** Foydalanuvchi borligini oshkor qilmaslik uchun har doim ok. */
  async forgotPassword(input: ForgotPasswordInput, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, isActive: true },
    });
    if (user?.isActive) {
      const raw = randomBytes(32).toString('base64url');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(raw).digest('hex'),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      await this.audit.record({ userId: user.id, action: 'PASSWORD_RESET_REQUEST', ...client });
      // Pochta yuborish hali ulanmagan — token faqat dev logda.
      this.logger.debug(`Password reset token for ${user.id}: ${raw}`);
    }
    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput, client: ClientInfo) {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Havola noto‘g‘ri yoki muddati o‘tgan');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await this.passwords.hash(input.password), mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await this.tokens.revokeAllForUser(record.userId);
    await this.audit.record({ userId: record.userId, action: 'PASSWORD_RESET_COMPLETE', ...client });
    return { ok: true };
  }

  private async startSession(userId: string, client: ClientInfo): Promise<AuthResult> {
    const user = await this.profile(userId);
    const pair = await this.tokens.issue(this.payloadOf(user), client);
    return { ...pair, user };
  }

  private payloadOf(user: { id: string; email: string; roles: Role[]; permissions: string[] }) {
    return { sub: user.id, email: user.email, roles: user.roles, permissions: user.permissions };
  }

  /**
   * Yangi avatarlar public bucket'da (doimiy URL). Eskilari private bucket'ning
   * muddati o'tadigan presigned URL'i sifatida saqlangan — ularni qayta imzolaymiz.
   */
  async resolveAvatar(url: string | null): Promise<string | null> {
    if (!url) return null;
    const loc = this.storage.locate(url);
    if (loc?.bucket !== 'private') return url;
    return this.storage.downloadUrl(loc.key, 'avatar', 24 * 60 * 60);
  }

  private async dropAvatarFile(userId: string) {
    const { avatarUrl } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const loc = avatarUrl ? this.storage.locate(avatarUrl) : null;
    if (loc) await this.storage.remove(loc.key, loc.bucket);
  }
}

