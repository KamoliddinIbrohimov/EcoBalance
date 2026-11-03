import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type RoleSlug } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.service';

export interface NotificationInput {
  /** Masalan `assignment.graded`, `QUIZ_SUBMITTED` — web klient shu bo'yicha ikonka tanlaydi. */
  type: string;
  titleUz: string;
  bodyUz: string;
  /** Ixtiyoriy payload ({ assignmentId, ... }). */
  data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Foydalanuvchi(lar)ga bildirishnoma. Best-effort: xato asosiy amalni
   * (baholash, topshirish...) yiqitmaydi. Qaytaradi: yaratilganlar soni.
   */
  async notify(userIds: string | string[], input: NotificationInput): Promise<number> {
    const ids = [...new Set(([] as string[]).concat(userIds).filter(Boolean))];
    if (ids.length === 0) return 0;
    try {
      const res = await this.prisma.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          type: input.type.slice(0, 120),
          titleUz: input.titleUz.slice(0, 255),
          bodyUz: input.bodyUz.slice(0, 8000),
          data: input.data ?? Prisma.JsonNull,
        })),
      });
      return res.count;
    } catch (err) {
      this.logger.error({ err, type: input.type }, 'Bildirishnoma yaratilmadi');
      return 0;
    }
  }

  /** Rol bo'yicha barcha faol foydalanuvchilarga (masalan SA'ga test topshirildi xabari). */
  async notifyRole(role: RoleSlug, input: NotificationInput, exceptUserIds: string[] = []): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { slug: role } } }, id: { notIn: exceptUserIds } },
      select: { id: true },
    });
    return this.notify(users.map((u) => u.id), input);
  }

  async list(userId: string, limit: number) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      titleUz: r.titleUz,
      bodyUz: r.bodyUz,
      data: r.data,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
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
