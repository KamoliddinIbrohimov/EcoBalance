import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const roles = await this.prisma.role.findMany({ orderBy: { createdAt: 'asc' } });
    return roles.map((r) => ({
      id: r.id,
      slug: r.slug,
      nameUz: r.nameUz,
      description: r.description,
    }));
  }
}
