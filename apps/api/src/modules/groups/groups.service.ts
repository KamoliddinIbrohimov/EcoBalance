import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleSlug } from '@prisma/client';
import type {
  AddGroupMemberInput,
  CreateGroupInput,
  GroupDto,
  GroupMemberDto,
  GroupQuery,
  GroupWithTeacherDto,
  UpdateGroupInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';

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

function toGroupDto(row: GroupRow): GroupWithTeacherDto {
  return {
    id: row.id,
    nameUz: row.nameUz,
    descriptionUz: row.descriptionUz,
    teacherId: row.teacherId,
    isActive: row.isActive,
    memberCount: row._count.members,
    teacher: row.teacher,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ActorContext {
  id: string;
  roles: string[];
}

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(actor: ActorContext) {
    return actor.roles.includes('SUPER_ADMIN');
  }

  async list(query: GroupQuery, actor: ActorContext) {
    const { page, perPage, search, teacherId, isActive } = query;

    const where: Prisma.GroupWhereInput = {
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(search ? { nameUz: { contains: search, mode: 'insensitive' } } : {}),
    };

    if (this.isSuperAdmin(actor)) {
      if (teacherId) where.teacherId = teacherId;
    } else {
      // TEACHER faqat o'z guruhlarini ko'radi
      where.teacherId = actor.id;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        select: GROUP_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toGroupDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async detail(id: string, actor: ActorContext): Promise<GroupWithTeacherDto> {
    const row = await this.prisma.group.findUnique({ where: { id }, select: GROUP_SELECT });
    if (!row) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && row.teacherId !== actor.id) {
      throw new NotFoundException('Guruh topilmadi');
    }
    return toGroupDto(row);
  }

  async create(input: CreateGroupInput, actor: ActorContext): Promise<GroupDto> {
    // TEACHER o'ziga, SA — teacherId berilgan bo'lsa va o'qituvchi mavjud bo'lsa
    let teacherId: string;
    if (this.isSuperAdmin(actor)) {
      if (!input.teacherId) {
        throw new BadRequestException("SUPER_ADMIN uchun teacherId majburiy");
      }
      const teacher = await this.prisma.user.findFirst({
        where: {
          id: input.teacherId,
          roles: { some: { role: { slug: RoleSlug.TEACHER } } },
        },
        select: { id: true },
      });
      if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');
      teacherId = teacher.id;
    } else {
      // TEACHER o'z nomidan yaratadi (teacherId e'tiborga olinmaydi)
      teacherId = actor.id;
    }

    const row = await this.prisma.group.create({
      data: {
        id: uuidv7(),
        nameUz: input.nameUz.trim(),
        descriptionUz: input.descriptionUz?.trim() || null,
        teacherId,
      },
      select: GROUP_SELECT,
    });
    return toGroupDto(row);
  }

  async update(id: string, input: UpdateGroupInput, actor: ActorContext): Promise<GroupDto> {
    const existing = await this.prisma.group.findUnique({ where: { id }, select: { teacherId: true } });
    if (!existing) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && existing.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruhni tahrirlash huquqingiz yo‘q');
    }

    const row = await this.prisma.group.update({
      where: { id },
      data: {
        ...(input.nameUz !== undefined ? { nameUz: input.nameUz.trim() } : {}),
        ...(input.descriptionUz !== undefined
          ? { descriptionUz: input.descriptionUz?.trim() || null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: GROUP_SELECT,
    });
    return toGroupDto(row);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const existing = await this.prisma.group.findUnique({ where: { id }, select: { teacherId: true } });
    if (!existing) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && existing.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruhni o‘chirish huquqingiz yo‘q');
    }
    await this.prisma.group.delete({ where: { id } });
  }

  async listMembers(groupId: string, actor: ActorContext): Promise<GroupMemberDto[]> {
    await this.detail(groupId, actor); // ownership check
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => ({
      groupId: m.groupId,
      studentId: m.studentId,
      joinedAt: m.joinedAt.toISOString(),
      student: m.student,
    }));
  }

  async addMember(
    groupId: string,
    input: AddGroupMemberInput,
    actor: ActorContext,
  ): Promise<GroupMemberDto> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruhga a‘zo qo‘shish huquqingiz yo‘q');
    }

    // Talaba STUDENT roli bo'lsin
    const student = await this.prisma.user.findFirst({
      where: {
        id: input.studentId,
        roles: { some: { role: { slug: RoleSlug.STUDENT } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdById: true,
      },
    });
    if (!student) throw new NotFoundException('Talaba topilmadi yoki uning roli STUDENT emas');

    // TEACHER faqat o'zi yaratgan talabalarini qo'sha oladi
    if (!this.isSuperAdmin(actor) && student.createdById !== actor.id) {
      throw new ForbiddenException('Faqat o‘zingiz yaratgan talabani guruhingizga qo‘shishingiz mumkin');
    }

    // Talaba allaqachon biror guruhda bo'lsa — xato
    const existing = await this.prisma.groupMember.findUnique({ where: { studentId: student.id } });
    if (existing) {
      throw new ConflictException('Talaba allaqachon boshqa guruhda. Avval chiqarib oling.');
    }

    const member = await this.prisma.groupMember.create({
      data: { groupId, studentId: student.id },
    });
    return {
      groupId: member.groupId,
      studentId: member.studentId,
      joinedAt: member.joinedAt.toISOString(),
      student,
    };
  }

  // -------- Course / Quiz bindings --------

  private async assertGroupOwnership(groupId: string, actor: ActorContext) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { teacherId: true },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruhni boshqarish huquqingiz yo‘q');
    }
  }

  async listCourseBindings(groupId: string, actor: ActorContext) {
    await this.assertGroupOwnership(groupId, actor);
    const rows = await this.prisma.courseGroup.findMany({
      where: { groupId },
      include: {
        course: {
          select: { id: true, slug: true, nameUz: true, isPublished: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      courseId: r.courseId,
      groupId: r.groupId,
      course: r.course,
    }));
  }

  async bindCourse(groupId: string, courseId: string, actor: ActorContext) {
    await this.assertGroupOwnership(groupId, actor);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, ownerId: true },
    });
    if (!course) throw new NotFoundException('Kurs topilmadi');
    if (!this.isSuperAdmin(actor) && course.ownerId !== actor.id) {
      throw new ForbiddenException('Faqat o‘z kursingizni biriktira olasiz');
    }
    const existing = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId, groupId } },
    });
    if (existing) throw new ConflictException('Kurs allaqachon biriktirilgan');
    await this.prisma.courseGroup.create({ data: { courseId, groupId } });
    return { courseId, groupId };
  }

  async unbindCourse(groupId: string, courseId: string, actor: ActorContext) {
    await this.assertGroupOwnership(groupId, actor);
    const existing = await this.prisma.courseGroup.findUnique({
      where: { courseId_groupId: { courseId, groupId } },
    });
    if (!existing) throw new NotFoundException('Biriktirilma topilmadi');
    await this.prisma.courseGroup.delete({
      where: { courseId_groupId: { courseId, groupId } },
    });
  }

  async listQuizBindings(groupId: string, actor: ActorContext) {
    await this.assertGroupOwnership(groupId, actor);
    const rows = await this.prisma.groupQuiz.findMany({
      where: { groupId },
      include: {
        quiz: { select: { id: true, titleUz: true, isPublished: true, lessonId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      quizId: r.quizId,
      groupId: r.groupId,
      quiz: r.quiz,
    }));
  }

  async bindQuiz(groupId: string, quizId: string, actor: ActorContext) {
    await this.assertGroupOwnership(groupId, actor);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, ownerId: true },
    });
    if (!quiz) throw new NotFoundException('Test topilmadi');
    if (!this.isSuperAdmin(actor) && quiz.ownerId !== actor.id) {
      throw new ForbiddenException('Faqat o‘z testingizni biriktira olasiz');
    }
    const existing = await this.prisma.groupQuiz.findUnique({
      where: { quizId_groupId: { quizId, groupId } },
    });
    if (existing) throw new ConflictException('Test allaqachon biriktirilgan');
    await this.prisma.groupQuiz.create({ data: { quizId, groupId } });
    return { quizId, groupId };
  }

  async unbindQuiz(groupId: string, quizId: string, actor: ActorContext) {
    await this.assertGroupOwnership(groupId, actor);
    const existing = await this.prisma.groupQuiz.findUnique({
      where: { quizId_groupId: { quizId, groupId } },
    });
    if (!existing) throw new NotFoundException('Biriktirilma topilmadi');
    await this.prisma.groupQuiz.delete({
      where: { quizId_groupId: { quizId, groupId } },
    });
  }

  async removeMember(groupId: string, studentId: string, actor: ActorContext): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!this.isSuperAdmin(actor) && group.teacherId !== actor.id) {
      throw new ForbiddenException('Bu guruhdan a‘zo chiqarish huquqingiz yo‘q');
    }

    const existing = await this.prisma.groupMember.findFirst({ where: { groupId, studentId } });
    if (!existing) throw new NotFoundException('A‘zolik topilmadi');
    await this.prisma.groupMember.delete({
      where: { groupId_studentId: { groupId, studentId } },
    });
  }
}
