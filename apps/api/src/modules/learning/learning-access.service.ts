import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.service';
import { type Actor, isAdmin, isStudent, isTeacher } from '../auth/actor';
import { ASSIGNMENT_SELECT, type AssignmentRow, SUBMISSION_SELECT } from './learning.mappers';

const MANAGED_SUBMISSION_SELECT = {
  ...SUBMISSION_SELECT,
  assignment: {
    select: {
      id: true,
      kind: true,
      titleUz: true,
      maxScore: true,
      latePenaltyPercent: true,
      createdById: true,
      group: { select: { teacherId: true } },
    },
  },
} satisfies Prisma.AssignmentSubmissionSelect;

export type ManagedSubmission = Prisma.AssignmentSubmissionGetPayload<{ select: typeof MANAGED_SUBMISSION_SELECT }>;

interface Ownable {
  createdById: string;
  group: { teacherId: string };
}

/**
 * Learning domenining egalik qoidalari bir joyda:
 *  - SA — hammasi;
 *  - o'qituvchi — o'zi yaratgan yoki o'z guruhidagi topshiriqlar;
 *  - talaba — faqat o'z guruhining (nashr etilgan kurs) topshiriqlari.
 * Begona resurs — 404 (mavjudligini oshkor qilmaymiz).
 */
@Injectable()
export class LearningAccess {
  constructor(private readonly prisma: PrismaService) {}

  canManage(a: Ownable, actor: Actor): boolean {
    return isAdmin(actor) || a.createdById === actor.id || a.group.teacherId === actor.id;
  }

  /** Talabaning guruhi (bitta talaba — bitta guruh). */
  membership(studentId: string) {
    return this.prisma.groupMember.findUnique({
      where: { studentId },
      select: { groupId: true, group: { select: { isActive: true, teacherId: true } } },
    });
  }

  async managedAssignment(id: string, actor: Actor): Promise<AssignmentRow> {
    const a = await this.prisma.assignment.findUnique({ where: { id }, select: ASSIGNMENT_SELECT });
    if (!a || !this.canManage(a, actor)) throw new NotFoundException('Topshiriq topilmadi');
    return a;
  }

  /** Talabaga ko'rinadigan topshiriq: o'z guruhi va kurs nashr etilgan (yoki kurssiz). */
  async studentAssignment(id: string, actor: Actor): Promise<AssignmentRow> {
    const [a, member] = await Promise.all([
      this.prisma.assignment.findUnique({ where: { id }, select: ASSIGNMENT_SELECT }),
      this.membership(actor.id),
    ]);
    const visible = a && member?.groupId === a.groupId && (a.courseId === null || a.course?.isPublished);
    if (!visible) throw new NotFoundException('Topshiriq topilmadi');
    return a;
  }

  /** Rolga qarab: boshqaruvchi yoki talaba sifatida ko'ra oladimi. */
  readableAssignment(id: string, actor: Actor): Promise<AssignmentRow> {
    return isStudent(actor) ? this.studentAssignment(id, actor) : this.managedAssignment(id, actor);
  }

  async managedSubmission(id: string, actor: Actor): Promise<ManagedSubmission> {
    const s = await this.prisma.assignmentSubmission.findUnique({ where: { id }, select: MANAGED_SUBMISSION_SELECT });
    if (!s || !this.canManage(s.assignment, actor)) throw new NotFoundException('Javob topilmadi');
    return s;
  }

  async managedGroup(groupId: string, actor: Actor) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { id: true, teacherId: true } });
    if (!group || (!isAdmin(actor) && group.teacherId !== actor.id)) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  /** Talaba — faqat o'zi; o'qituvchi — o'zi yaratgan yoki o'z guruhidagi talaba. */
  async assertCanViewStudent(studentId: string, actor: Actor): Promise<void> {
    if (isStudent(actor) && studentId !== actor.id) throw new NotFoundException('Talaba topilmadi');
    const [user, member] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: studentId }, select: { createdById: true } }),
      isTeacher(actor) ? this.membership(studentId) : null,
    ]);
    const visible =
      user && (!isTeacher(actor) || user.createdById === actor.id || member?.group.teacherId === actor.id);
    if (!visible) throw new NotFoundException('Talaba topilmadi');
  }
}
