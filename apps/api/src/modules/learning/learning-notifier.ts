import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.service';

export interface LearningNotice {
  type: string;
  titleUz: string;
  bodyUz: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Ilova ichidagi bildirishnomalar (`notifications` jadvali). Platform modulidan
 * mustaqil — bildirishnoma yozilmay qolsa ham asosiy amal yiqilmaydi.
 */
@Injectable()
export class LearningNotifier {
  private readonly logger = new Logger(LearningNotifier.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(userIds: Array<string | null | undefined>, notice: LearningNotice): Promise<void> {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          type: notice.type,
          titleUz: notice.titleUz.slice(0, 255),
          bodyUz: notice.bodyUz.slice(0, 8000),
          data: notice.data ?? Prisma.JsonNull,
        })),
      });
    } catch (err) {
      this.logger.error({ err, type: notice.type }, 'Bildirishnoma yozilmadi');
    }
  }

  async notifyGroup(groupId: string, notice: LearningNotice): Promise<void> {
    const members = await this.prisma.groupMember.findMany({ where: { groupId }, select: { studentId: true } });
    await this.notify(members.map((m) => m.studentId), notice);
  }
}
