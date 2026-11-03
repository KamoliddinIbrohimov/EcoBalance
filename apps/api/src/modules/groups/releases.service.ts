import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { GroupLessonRelease, Prisma } from '@prisma/client';
import type { GroupLessonReleaseDto, UpsertReleaseInput } from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import type { Actor } from '../auth/actor';
import { GroupAccess } from './group-access.service';
import { assertOpenBeforeClose } from './release-policy';

function toDto(r: GroupLessonRelease): GroupLessonReleaseDto {
  return {
    id: r.id,
    groupId: r.groupId,
    lessonId: r.lessonId,
    moduleId: r.moduleId,
    opensAt: r.opensAt?.toISOString() ?? null,
    closesAt: r.closesAt?.toISOString() ?? null,
    status: r.status,
  };
}

/**
 * Guruh uchun dars/modul ochilishi. Release yo'q — dars ochiq (standart oqim);
 * qoidalar `release-policy.ts`da.
 */
@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccess,
  ) {}

  async list(groupId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const rows = await this.prisma.groupLessonRelease.findMany({ where: { groupId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toDto);
  }

  /** Bir dars/modul uchun bitta yozuv — mavjud bo'lsa yangilanadi. */
  async upsert(groupId: string, input: UpsertReleaseInput, actor: Actor) {
    await this.access.owned(groupId, actor);
    const window = { opensAt: input.opensAt ?? null, closesAt: input.closesAt ?? null };
    assertOpenBeforeClose(window);
    if (input.status === 'SCHEDULED' && !window.opensAt) {
      throw new BadRequestException('SCHEDULED uchun opensAt majburiy');
    }
    const target = await this.target(input);
    const bound = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId: target.courseId, groupId } },
      select: { courseId: true },
    });
    if (!bound) throw new BadRequestException('Kurs bu guruhga biriktirilmagan');

    // (groupId, lessonId, moduleId) unique'da NULL'lar teng emas — upsert ishlamaydi.
    const key = { groupId, lessonId: input.lessonId ?? null, moduleId: input.moduleId ?? null };
    const data = { ...window, status: input.status };
    const existing = await this.prisma.groupLessonRelease.findFirst({ where: key, select: { id: true } });
    const row = existing
      ? await this.prisma.groupLessonRelease.update({ where: { id: existing.id }, data })
      : await this.prisma.groupLessonRelease.create({ data: { ...key, ...data } });

    if (row.status === 'OPEN') await this.notifyOpened(groupId, row.id, target.title);
    return toDto(row);
  }

  async remove(groupId: string, releaseId: string, actor: Actor) {
    await this.access.owned(groupId, actor);
    const { count } = await this.prisma.groupLessonRelease.deleteMany({ where: { id: releaseId, groupId } });
    if (count === 0) throw new NotFoundException('Release topilmadi');
  }

  private async target(input: UpsertReleaseInput): Promise<{ courseId: string; title: string }> {
    const row = input.lessonId
      ? await this.prisma.lesson.findUnique({ where: { id: input.lessonId }, select: { courseId: true, titleUz: true } })
      : await this.prisma.module.findUnique({ where: { id: input.moduleId! }, select: { courseId: true, titleUz: true } });
    if (!row) throw new NotFoundException(input.lessonId ? 'Dars topilmadi' : 'Modul topilmadi');
    return { courseId: row.courseId, title: row.titleUz };
  }

  /** Har release uchun bir martalik xabar — qayta OPEN qilinsa takrorlanmaydi. */
  private async notifyOpened(groupId: string, releaseId: string, title: string) {
    const members = await this.prisma.groupMember.findMany({ where: { groupId }, select: { studentId: true } });
    if (members.length === 0) return;
    const ids = members.map((m) => m.studentId);
    const already = await this.prisma.notification.findMany({
      where: { userId: { in: ids }, type: 'RELEASE_OPEN', data: { path: ['releaseId'], equals: releaseId } },
      select: { userId: true },
    });
    const sent = new Set(already.map((n) => n.userId));
    const targets = ids.filter((id) => !sent.has(id));
    if (targets.length === 0) return;
    await this.prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        type: 'RELEASE_OPEN',
        titleUz: 'Dars ochildi',
        bodyUz: `"${title}" dars/mavzusi ochildi — davom etishingiz mumkin.`,
        data: { releaseId } satisfies Prisma.InputJsonValue,
      })),
    });
  }
}
