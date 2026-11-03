import { Controller, Get } from '@nestjs/common';
import type { OrganizationTreeNode } from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import { Roles } from '../auth/actor';

/**
 * Tashkilotlar eski 7-rolli modeldan qolgan; hozir faqat foydalanuvchi
 * formasida tanlash uchun daraxt kerak (CRUD sahifasi web'da yopilgan).
 */
@Controller('organizations')
@Roles('SUPER_ADMIN', 'TEACHER')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tree')
  async tree(): Promise<OrganizationTreeNode[]> {
    const rows = await this.prisma.organization.findMany({
      orderBy: { nameUz: 'asc' },
      include: { _count: { select: { users: true, children: true } } },
    });
    const nodes = new Map<string, OrganizationTreeNode>(
      rows.map((o) => [
        o.id,
        {
          id: o.id,
          parentId: o.parentId,
          type: o.type,
          nameUz: o.nameUz,
          code: o.code,
          address: (o.address as Record<string, unknown> | null) ?? null,
          latitude: o.latitude === null ? null : Number(o.latitude),
          longitude: o.longitude === null ? null : Number(o.longitude),
          usersCount: o._count.users,
          childrenCount: o._count.children,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          children: [],
        },
      ]),
    );
    const roots: OrganizationTreeNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }
}
