import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, RoleSlug } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput, UserQuery } from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { AuditService } from '../../infra/audit.service';
import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { type Actor, type ClientInfo, isAdmin } from '../auth/actor';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  locale: true,
  isActive: true,
  organizationId: true,
  createdById: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, nameUz: true, type: true } },
  roles: { select: { role: { select: { slug: true } } } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/**
 * SA — hamma foydalanuvchilar. O'qituvchi — faqat o'zi yaratgan talabalar;
 * begonasi uchun 404 (mavjudligini oshkor qilmaymiz).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async list(q: UserQuery, actor: Actor) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.UserWhereInput = {
      organizationId: q.organizationId,
      isActive: q.isActive,
      roles: q.role ? { some: { role: { slug: q.role } } } : undefined,
      createdById: isAdmin(actor) ? undefined : actor.id,
      OR: q.search
        ? (['firstName', 'lastName', 'email', 'phone'] as const).map((f) => ({
            [f]: { contains: q.search, mode: 'insensitive' as const },
          }))
        : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return toPage(await Promise.all(rows.map((r) => this.toDto(r))), total, page, perPage);
  }

  async detail(id: string, actor: Actor) {
    return this.toDto(await this.findVisible(id, actor, true));
  }

  async create(input: CreateUserInput, actor: Actor, client: ClientInfo) {
    this.assertAssignableRoles(input.roleSlugs, actor);
    if (!isAdmin(actor) && input.organizationId) {
      const self = await this.prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { organizationId: true },
      });
      if (self.organizationId && self.organizationId !== input.organizationId) {
        throw new ForbiddenException('O‘qituvchi faqat o‘z tashkilotiga talaba qo‘sha oladi');
      }
    }

    const roleIds = await this.roleIds(input.roleSlugs);
    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone ?? null,
          passwordHash: await this.passwords.hash(input.password),
          isActive: input.isActive,
          organizationId: input.organizationId ?? null,
          createdById: actor.id,
          mustChangePassword: true,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        select: USER_SELECT,
      });
      await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'User', subjectId: user.id, ...client });
      return this.toDto(user);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Bu email yoki telefon allaqachon ro‘yxatdan o‘tgan');
      throw err;
    }
  }

  async update(id: string, input: UpdateUserInput, actor: Actor, client: ClientInfo) {
    const target = await this.findVisible(id, actor, false);
    const self = id === actor.id;
    if (self && !isAdmin(actor)) {
      throw new ForbiddenException('O‘z profilingizni Sozlamalar → Profil orqali tahrirlang');
    }
    if (input.roleSlugs) {
      if (self) throw new ForbiddenException('O‘z rolingizni o‘zgartira olmaysiz');
      this.assertAssignableRoles(input.roleSlugs, actor);
    }
    if (input.isActive === false) this.assertCanDeactivate(target, actor);

    const roleIds = input.roleSlugs ? await this.roleIds(input.roleSlugs) : null;
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          firstName: input.firstName?.trim(),
          lastName: input.lastName?.trim(),
          phone: input.phone,
          locale: input.locale,
          isActive: input.isActive,
          organizationId: input.organizationId,
          roles: roleIds ? { deleteMany: {}, create: roleIds.map((roleId) => ({ roleId })) } : undefined,
        },
        select: USER_SELECT,
      });
      if (input.isActive === false) await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'User', subjectId: id, changes: input, ...client });
      return this.toDto(user);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Bu telefon raqami band');
      throw err;
    }
  }

  /**
   * O'chirish = faolsizlantirish + anonimlashtirish: email bo'shaydi (qayta
   * ishlatish mumkin), tarix va audit saqlanadi.
   */
  async deactivate(id: string, actor: Actor, client: ClientInfo) {
    const target = await this.findVisible(id, actor, false);
    this.assertCanDeactivate(target, actor);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: false, email: `deleted-${id}@invalid.local`, phone: null },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'User', subjectId: id, ...client });
    return { ok: true };
  }

  async roles() {
    const rows = await this.prisma.role.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(({ id, slug, nameUz, description }) => ({ id, slug, nameUz, description }));
  }

  private async findVisible(id: string, actor: Actor, allowSelf: boolean): Promise<UserRow> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    const visible = user && (isAdmin(actor) || user.createdById === actor.id || (allowSelf && id === actor.id));
    if (!visible) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  private assertAssignableRoles(roles: RoleSlug[], actor: Actor) {
    if (roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Tizimda faqat bitta SUPER_ADMIN bo‘lishi mumkin');
    }
    if (!isAdmin(actor) && roles.some((r) => r !== 'STUDENT')) {
      throw new ForbiddenException('O‘qituvchi faqat talaba yarata oladi');
    }
  }

  private assertCanDeactivate(target: UserRow, actor: Actor) {
    if (target.id === actor.id) throw new ForbiddenException('O‘zingizni faolsizlantira olmaysiz');
    if (target.roles.some((r) => r.role.slug === 'SUPER_ADMIN')) {
      throw new ForbiddenException('SUPER_ADMIN hisobini bloklab bo‘lmaydi');
    }
  }

  private async roleIds(slugs: RoleSlug[]) {
    const roles = await this.prisma.role.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
    if (roles.length !== new Set(slugs).size) throw new NotFoundException('Rol topilmadi');
    return roles.map((r) => r.id);
  }

  private async toDto(u: UserRow) {
    const { roles, createdById: _createdById, ...rest } = u;
    return {
      ...rest,
      avatarUrl: await this.auth.resolveAvatar(u.avatarUrl),
      roles: roles.map((r) => r.role.slug),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
