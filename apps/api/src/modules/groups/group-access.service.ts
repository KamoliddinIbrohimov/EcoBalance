import { Injectable, NotFoundException } from '@nestjs/common';
import type { ContentVisibility } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.service';
import { type Actor, isAdmin } from '../auth/actor';

/**
 * Guruh egaligi: SA — hammasi, o'qituvchi — faqat `teacherId` o'zi bo'lganlari.
 * Begona guruh uchun 404 (mavjudligini oshkor qilmaymiz).
 */
@Injectable()
export class GroupAccess {
  constructor(private readonly prisma: PrismaService) {}

  async owned(groupId: string, actor: Actor) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, teacherId: true },
    });
    if (!group || (!isAdmin(actor) && group.teacherId !== actor.id)) {
      throw new NotFoundException('Guruh topilmadi');
    }
    return group;
  }
}

/** Kurs/testni guruhga biriktirish mumkinmi: o'ziniki yoki LIBRARY. */
export function canBindContent(
  content: { ownerId: string | null; visibility: ContentVisibility },
  actor: Actor,
): boolean {
  return isAdmin(actor) || content.ownerId === actor.id || content.visibility === 'LIBRARY';
}
