import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';

export interface BroadcastInput {
  type: string;
  titleUz: string;
  bodyUz: string;
  /** Ixtiyoriy JSON payload (masalan { newsId, lessonId }). */
  data?: Prisma.InputJsonValue;
  /** Faqat shu ro'l/role slug bilan foydalanuvchilarga yuborish. */
  toRoles?: string[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Barcha faol foydalanuvchilarga bildirishnoma yaratadi.
   * Katta hajmda (masalan 10 000+ user) — chunked insertion.
   */
  async broadcast(input: BroadcastInput): Promise<number> {
    const where: Prisma.UserWhereInput = { isActive: true };
    if (input.toRoles && input.toRoles.length > 0) {
      where.roles = { some: { role: { slug: { in: input.toRoles as never } } } };
    }
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    if (users.length === 0) return 0;

    const rows = users.map((u) => ({
      id: uuidv7(),
      userId: u.id,
      type: input.type,
      titleUz: input.titleUz.slice(0, 255),
      bodyUz: input.bodyUz.slice(0, 8000),
      data: input.data ?? Prisma.JsonNull,
    }));

    const BATCH = 500;
    let created = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const res = await this.prisma.notification.createMany({ data: chunk, skipDuplicates: true });
      created += res.count;
    }
    this.logger.log(`broadcast type=${input.type} sent to ${created}/${users.length}`);
    return created;
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids: string[]) {
    if (ids.length === 0) return { updated: 0 };
    const res = await this.prisma.notification.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}
