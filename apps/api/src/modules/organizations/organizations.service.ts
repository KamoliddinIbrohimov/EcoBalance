import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type {
  CreateOrganizationInput,
  OrganizationQuery,
  OrganizationTreeNode,
  UpdateOrganizationInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestContext {
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

const SELECT = {
  id: true,
  parentId: true,
  type: true,
  nameUz: true,
  code: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, children: true } },
} satisfies Prisma.OrganizationSelect;

type OrganizationRow = Prisma.OrganizationGetPayload<{ select: typeof SELECT }>;

function toDto(org: OrganizationRow) {
  return {
    id: org.id,
    parentId: org.parentId,
    type: org.type,
    nameUz: org.nameUz,
    code: org.code,
    address: (org.address as Record<string, unknown> | null) ?? null,
    latitude: org.latitude !== null ? Number(org.latitude) : null,
    longitude: org.longitude !== null ? Number(org.longitude) : null,
    usersCount: org._count.users,
    childrenCount: org._count.children,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: OrganizationQuery) {
    const { page, perPage, search, type, parentId } = query;

    const where: Prisma.OrganizationWhereInput = {
      ...(type ? { type } : {}),
      ...(parentId ? { parentId } : {}),
      ...(search
        ? {
            OR: [
              { nameUz: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        select: SELECT,
        orderBy: { nameUz: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  /** Full hierarchy (city → district → mahalla/school/...), for tree pickers/sidebars. */
  async tree(): Promise<OrganizationTreeNode[]> {
    const all = await this.prisma.organization.findMany({
      select: SELECT,
      orderBy: { nameUz: 'asc' },
    });

    const nodes = new Map<string, OrganizationTreeNode>(
      all.map((o) => [o.id, { ...toDto(o), children: [] }]),
    );
    const roots: OrganizationTreeNode[] = [];

    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: SELECT });
    if (!org) throw new NotFoundException('Tashkilot topilmadi');
    return toDto(org);
  }

  async create(dto: CreateOrganizationInput, ctx: RequestContext) {
    const code = dto.code.trim().toLowerCase();
    const existing = await this.prisma.organization.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Bu kod bilan tashkilot allaqachon mavjud');

    if (dto.parentId) {
      const parent = await this.prisma.organization.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Ota tashkilot topilmadi');
    }

    const org = await this.prisma.organization.create({
      data: {
        id: uuidv7(),
        parentId: dto.parentId ?? null,
        type: dto.type,
        nameUz: dto.nameUz.trim(),
        code,
        address: (dto.address ?? undefined) as Prisma.InputJsonValue | undefined,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      },
      select: SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'Organization',
      subjectId: org.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toDto(org);
  }

  async update(id: string, dto: UpdateOrganizationInput, ctx: RequestContext) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tashkilot topilmadi');

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new UnprocessableEntityException(
          'Tashkilot o‘zini ota tashkilot qilib bo‘lmaydi',
        );
      }
      const parent = await this.prisma.organization.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Ota tashkilot topilmadi');
      await this.assertNoCycle(id, dto.parentId);
    }

    let code: string | undefined;
    if (dto.code !== undefined) {
      code = dto.code.trim().toLowerCase();
      const clash = await this.prisma.organization.findFirst({ where: { code, NOT: { id } } });
      if (clash) throw new ConflictException('Bu kod bilan tashkilot allaqachon mavjud');
    }

    const org = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.nameUz !== undefined ? { nameUz: dto.nameUz.trim() } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(dto.address !== undefined
          ? { address: (dto.address ?? Prisma.JsonNull) as Prisma.InputJsonValue }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
      select: SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'Organization',
      subjectId: id,
      changes: dto as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toDto(org);
  }

  async remove(id: string, ctx: RequestContext) {
    const existing = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true, children: true } } },
    });
    if (!existing) throw new NotFoundException('Tashkilot topilmadi');

    if (existing._count.users > 0 || existing._count.children > 0) {
      throw new ConflictException(
        'Ushbu tashkilotga bog‘langan foydalanuvchilar yoki quyi tashkilotlar mavjud — avval ularni boshqa tashkilotga ko‘chiring',
      );
    }

    await this.prisma.organization.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'Organization',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }

  /** Walk up from `newParentId`'s ancestors to make sure `id` isn't among them (would create a cycle). */
  private async assertNoCycle(id: string, newParentId: string): Promise<void> {
    let current: string | null = newParentId;
    const seen = new Set<string>();

    while (current) {
      if (current === id) {
        throw new UnprocessableEntityException(
          'Tashkilotlar ierarxiyasida aylanma bog‘lanishga yo‘l qo‘yilmaydi',
        );
      }
      if (seen.has(current)) break;
      seen.add(current);

      const parent: { parentId: string | null } | null =
        await this.prisma.organization.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = parent?.parentId ?? null;
    }
  }
}
