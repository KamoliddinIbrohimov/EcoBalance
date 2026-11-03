import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CreateGroupInput, GroupQuery, GroupWithTeacherDto, UpdateGroupInput } from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { AuditService } from '../../infra/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import { type Actor, type ClientInfo, isAdmin } from '../auth/actor';
import { GroupAccess } from './group-access.service';

const GROUP_SELECT = {
  id: true,
  nameUz: true,
  descriptionUz: true,
  teacherId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.GroupSelect;

type GroupRow = Prisma.GroupGetPayload<{ select: typeof GROUP_SELECT }>;

function toDto(row: GroupRow): GroupWithTeacherDto {
  const { _count, createdAt, updatedAt, ...rest } = row;
  return {
    ...rest,
    memberCount: _count.members,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccess,
    private readonly audit: AuditService,
  ) {}

  async list(q: GroupQuery, actor: Actor) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.GroupWhereInput = {
      isActive: q.isActive,
      teacherId: isAdmin(actor) ? q.teacherId : actor.id,
      nameUz: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({ where, select: GROUP_SELECT, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return toPage(rows.map(toDto), total, page, perPage);
  }

  async detail(id: string, actor: Actor) {
    await this.access.owned(id, actor);
    return toDto(await this.prisma.group.findUniqueOrThrow({ where: { id }, select: GROUP_SELECT }));
  }

  async create(input: CreateGroupInput, actor: Actor, client: ClientInfo) {
    const teacherId = isAdmin(actor) ? await this.assignableTeacher(input.teacherId) : actor.id;
    const row = await this.prisma.group.create({
      data: {
        nameUz: input.nameUz.trim(),
        descriptionUz: input.descriptionUz?.trim() || null,
        teacherId,
      },
      select: GROUP_SELECT,
    });
    await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'Group', subjectId: row.id, ...client });
    return toDto(row);
  }

  async update(id: string, input: UpdateGroupInput, actor: Actor, client: ClientInfo) {
    await this.access.owned(id, actor);
    const row = await this.prisma.group.update({
      where: { id },
      data: {
        nameUz: input.nameUz?.trim(),
        descriptionUz: input.descriptionUz === undefined ? undefined : input.descriptionUz?.trim() || null,
        isActive: input.isActive,
      },
      select: GROUP_SELECT,
    });
    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      subjectType: 'Group',
      subjectId: id,
      changes: input,
      ...client,
    });
    return toDto(row);
  }

  /** A'zolik, biriktirmalar, release'lar va topshiriqlar kaskad o'chadi. */
  async remove(id: string, actor: Actor, client: ClientInfo) {
    await this.access.owned(id, actor);
    await this.prisma.group.delete({ where: { id } });
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'Group', subjectId: id, ...client });
  }

  private async assignableTeacher(teacherId: string | undefined) {
    if (!teacherId) throw new BadRequestException('SUPER_ADMIN uchun teacherId majburiy');
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, isActive: true, roles: { some: { role: { slug: 'TEACHER' } } } },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');
    return teacher.id;
  }
}
