import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { GroupMemberDto } from '@eco/shared';

import { AuditService } from '../../infra/audit.service';
import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { type Actor, type ClientInfo, isAdmin } from '../auth/actor';
import { GroupAccess } from './group-access.service';

const STUDENT_SELECT = { id: true, firstName: true, lastName: true, email: true, isActive: true } as const;

/** Talaba bir vaqtda faqat bitta guruhda (GroupMember.studentId unique). */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccess,
    private readonly audit: AuditService,
  ) {}

  async list(groupId: string, actor: Actor): Promise<GroupMemberDto[]> {
    await this.access.owned(groupId, actor);
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: { student: { select: STUDENT_SELECT } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      groupId: m.groupId,
      studentId: m.studentId,
      joinedAt: m.joinedAt.toISOString(),
      student: m.student,
    }));
  }

  async add(groupId: string, studentId: string, actor: Actor, client: ClientInfo): Promise<GroupMemberDto> {
    await this.access.owned(groupId, actor);
    // O'qituvchi faqat o'zi yaratgan talabani qo'sha oladi; begonasi — 404.
    const student = await this.prisma.user.findFirst({
      where: {
        id: studentId,
        roles: { some: { role: { slug: 'STUDENT' } } },
        createdById: isAdmin(actor) ? undefined : actor.id,
      },
      select: STUDENT_SELECT,
    });
    if (!student) throw new NotFoundException('Talaba topilmadi');

    const current = await this.prisma.groupMember.findUnique({ where: { studentId }, select: { groupId: true } });
    if (current) throw new ConflictException(this.conflictMessage(current.groupId === groupId));

    try {
      const member = await this.prisma.groupMember.create({ data: { groupId, studentId } });
      await this.audit.record({
        userId: actor.id,
        action: 'CREATE',
        subjectType: 'GroupMember',
        subjectId: groupId,
        changes: { studentId },
        ...client,
      });
      return { groupId, studentId, joinedAt: member.joinedAt.toISOString(), student };
    } catch (err) {
      // Parallel so'rov boshqa guruhga qo'shib ulgurgan bo'lishi mumkin.
      if (isUniqueViolation(err)) throw new ConflictException(this.conflictMessage(false));
      throw err;
    }
  }

  async remove(groupId: string, studentId: string, actor: Actor, client: ClientInfo) {
    await this.access.owned(groupId, actor);
    const { count } = await this.prisma.groupMember.deleteMany({ where: { groupId, studentId } });
    if (count === 0) throw new NotFoundException('A‘zolik topilmadi');
    await this.audit.record({
      userId: actor.id,
      action: 'DELETE',
      subjectType: 'GroupMember',
      subjectId: groupId,
      changes: { studentId },
      ...client,
    });
  }

  private conflictMessage(sameGroup: boolean) {
    return sameGroup
      ? 'Talaba allaqachon shu guruhda'
      : 'Talaba allaqachon boshqa guruhda. Avval chiqarib oling.';
  }
}
