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

  async list(query: UserQuery, actorRoles: string[] = [], actorId?: string) {
    const { page, perPage, search, organizationId, role, isActive } = query;
    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');

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

    // TEACHER faqat o'zi yaratgan foydalanuvchilarni (odatda STUDENT) ko'radi.
    // Boshqa o'qituvchi, admin yoki boshqa guruh talabalari ko'rinmaydi.
    if (!isSuperAdmin && actorId) {
      where.createdById = actorId;
    }

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

  async findAdminDetail(id: string, actorRoles: string[] = [], actorId?: string) {
    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    const user = await this.prisma.user.findUnique({ where: { id }, select: ADMIN_SELECT });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    // TEACHER faqat o'zi yaratgan foydalanuvchini ko'radi (404 — probe-safe).
    const isSelf = actorId === id;
    const createdByActor = await this.wasCreatedBy(id, actorId);
    if (!isSuperAdmin && !isSelf && !createdByActor) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    return toAdminDto(user);
  }

  private async wasCreatedBy(userId: string, actorId?: string): Promise<boolean> {
    if (!actorId) return false;
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdById: true },
    });
    return row?.createdById === actorId;
  }

  async create(
    dto: CreateUserInput,
    ctx: RequestContext,
    actorRoles: string[] = [],
  ) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');

    if (dto.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      });
      if (!org) throw new NotFoundException('Tashkilot topilmadi');
    }

    // --- 3-rol LMS cheklovi ---------------------------------------
    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    const isTeacher = actorRoles.includes('TEACHER') && !isSuperAdmin;

    if (isTeacher) {
      // Teacher faqat STUDENT yarata oladi — hech boshqa rol emas
      const invalid = dto.roleSlugs.filter((s) => s !== 'STUDENT');
      if (invalid.length > 0) {
        throw new ForbiddenException(
          'O‘qituvchi faqat STUDENT (talaba) yarata oladi',
        );
      }
    }
    if (dto.roleSlugs.includes('SUPER_ADMIN')) {
      // DB trigger ushlab oladi, lekin aniq xato xabari uchun erta tekshirish
      throw new ForbiddenException(
        'Tizimda faqat BITTA SUPER_ADMIN bo‘lishi mumkin',
      );
    }
    // --------------------------------------------------------------

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
        createdById: ctx.actorId ?? null,
        mustChangePassword: true, // SA/TEACHER yaratgan — vaqtincha parol
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

  async update(id: string, dto: UpdateUserInput, ctx: RequestContext, actorRoles: string[] = []) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException('Foydalanuvchi topilmadi');

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    const isSelf = ctx.actorId === id;
    const createdByActor = existing.createdById === ctx.actorId;

    // TEACHER faqat o'zi yaratgan foydalanuvchini tahrir qila oladi.
    // O'zini (profilini) ham tahrir qila olmaydi bu endpoint orqali — buning
    // uchun /auth/me alohida.
    if (!isSuperAdmin && !createdByActor) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    if (!isSuperAdmin && isSelf) {
      throw new ForbiddenException('O‘z profilingizni Settings → Profile orqali tahrirlang');
    }

    // Super Admin ham o'z rolini o'zgartira olmaydi (singleton).
    if (dto.roleSlugs && isSelf) {
      throw new ForbiddenException('O‘z rolingizni o‘zgartira olmaysiz');
    }

    // TEACHER STUDENT'ni boshqa rolga o'zgartira olmaydi.
    if (dto.roleSlugs && !isSuperAdmin) {
      const invalid = dto.roleSlugs.filter((s) => s !== 'STUDENT');
      if (invalid.length > 0) {
        throw new ForbiddenException(
          'O‘qituvchi o‘z talabasini faqat STUDENT holatida qoldirishi mumkin',
        );
      }
    }
    // Hech kim SUPER_ADMIN qila olmaydi (DB trigger ushlab oladi, lekin UX uchun erta rad)
    if (dto.roleSlugs?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Tizimda faqat BITTA SUPER_ADMIN bo‘lishi mumkin');
    }

    // Super Admin'ni blocklab bo'lmaydi.
    if (dto.isActive === false) {
      const targetIsSuperAdmin = existing.roles.some((r) => r.role.slug === 'SUPER_ADMIN');
      if (targetIsSuperAdmin) {
        throw new ForbiddenException('SUPER_ADMIN hisobini bloklab bo‘lmaydi');
      }
    }

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
  async deactivate(id: string, ctx: RequestContext, actorRoles: string[] = []) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (ctx.actorId === id) {
      throw new ForbiddenException('O‘zingizni faolsizlantira olmaysiz');
    }

    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && existing.createdById !== ctx.actorId) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    if (existing.roles.some((r) => r.role.slug === 'SUPER_ADMIN')) {
      throw new ForbiddenException('SUPER_ADMIN hisobini bloklab bo‘lmaydi');
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
