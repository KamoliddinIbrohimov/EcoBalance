import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, RoleSlug } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput, UserQuery } from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { PasswordService } from '../auth/services/password.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestContext {
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

/** Select shape shared by the admin list/detail/create/update responses. */
const ADMIN_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  locale: true,
  isActive: true,
  organizationId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, nameUz: true, type: true } },
  roles: { select: { role: { select: { slug: true } } } },
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof ADMIN_SELECT }>;

function toAdminDto(user: AdminUserRow) {
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
    organization: user.organization,
    roles: user.roles.map((r) => r.role.slug),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  /** Own-profile lookup used by GET /users/me/profile (dashboard shell). */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        locale: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async list(query: UserQuery) {
    const { page, perPage, search, organizationId, role, isActive } = query;

    const where: Prisma.UserWhereInput = {
      ...(organizationId ? { organizationId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(role ? { roles: { some: { role: { slug: role as RoleSlug } } } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: ADMIN_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toAdminDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findAdminDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: ADMIN_SELECT });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return toAdminDto(user);
  }

  async create(dto: CreateUserInput, ctx: RequestContext) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');

    if (dto.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      });
      if (!org) throw new NotFoundException('Tashkilot topilmadi');
    }

    const roles = await this.prisma.role.findMany({
      where: { slug: { in: dto.roleSlugs as RoleSlug[] } },
    });
    if (roles.length !== dto.roleSlugs.length) {
      throw new NotFoundException('Ko‘rsatilgan rollardan biri topilmadi');
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
        isActive: dto.isActive ?? true,
        organizationId: dto.organizationId ?? null,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: ADMIN_SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'User',
      subjectId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toAdminDto(user);
  }

  async update(id: string, dto: UpdateUserInput, ctx: RequestContext) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (dto.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      });
      if (!org) throw new NotFoundException('Tashkilot topilmadi');
    }

    let roleUpdate: Prisma.UserUpdateInput['roles'] | undefined;
    if (dto.roleSlugs) {
      const roles = await this.prisma.role.findMany({
        where: { slug: { in: dto.roleSlugs as RoleSlug[] } },
      });
      if (roles.length !== dto.roleSlugs.length) {
        throw new NotFoundException('Ko‘rsatilgan rollardan biri topilmadi');
      }
      roleUpdate = {
        deleteMany: {},
        create: roles.map((r) => ({ roleId: r.id })),
      };
    }

    if (dto.isActive === false && ctx.actorId === id) {
      throw new ForbiddenException('O‘zingizni faolsizlantira olmaysiz');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.organizationId !== undefined ? { organizationId: dto.organizationId } : {}),
        ...(roleUpdate ? { roles: roleUpdate } : {}),
      },
      select: ADMIN_SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'User',
      subjectId: id,
      changes: dto as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toAdminDto(user);
  }

  /**
   * "Delete" is a deactivation (isActive=false), not a hard row delete:
   * audit_logs must survive a removed user (Phase 0 design — see AuditLog's
   * onDelete: SetNull), and government-facing admin tools generally prefer a
   * reversible deactivate over destroying history. Reactivating is a normal
   * `PATCH /users/:id` with `{ isActive: true }`.
   */
  async deactivate(id: string, ctx: RequestContext) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (ctx.actorId === id) {
      throw new ForbiddenException('O‘zingizni faolsizlantira olmaysiz');
    }

    await this.prisma.user.update({ where: { id }, data: { isActive: false } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'User',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }
}
