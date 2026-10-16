import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateModuleInput,
  ModuleDto,
  UpdateModuleInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';

const MODULE_SELECT = {
  id: true,
  courseId: true,
  orderIndex: true,
  titleUz: true,
  descriptionUz: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModuleSelect;

type ModuleRow = Prisma.ModuleGetPayload<{ select: typeof MODULE_SELECT }>;

function toModuleDto(r: ModuleRow): ModuleDto {
  return {
    id: r.id,
    courseId: r.courseId,
    orderIndex: r.orderIndex,
    titleUz: r.titleUz,
    descriptionUz: r.descriptionUz,
    isPublished: r.isPublished,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourseOwnership(courseId: string, actorId: string, roles: string[]) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    if (!course) throw new NotFoundException('Kurs topilmadi');
    if (!roles.includes('SUPER_ADMIN') && course.ownerId !== actorId) {
      throw new ForbiddenException("Faqat o'z kursingiz modullarini boshqara olasiz");
    }
  }

  async listByCourse(courseId: string): Promise<ModuleDto[]> {
    const rows = await this.prisma.module.findMany({
      where: { courseId },
      select: MODULE_SELECT,
      orderBy: { orderIndex: 'asc' },
    });
    return rows.map(toModuleDto);
  }

  async create(input: CreateModuleInput, actorId: string, roles: string[]): Promise<ModuleDto> {
    await this.assertCourseOwnership(input.courseId, actorId, roles);
    const next =
      input.orderIndex ??
      ((
        await this.prisma.module.aggregate({
          where: { courseId: input.courseId },
          _max: { orderIndex: true },
        })
      )._max.orderIndex ?? -1) + 1;
    const clash = await this.prisma.module.findFirst({
      where: { courseId: input.courseId, orderIndex: next },
    });
    if (clash) {
      throw new ConflictException(`#${next} tartibli modul mavjud`);
    }
    const row = await this.prisma.module.create({
      data: {
        id: uuidv7(),
        courseId: input.courseId,
        orderIndex: next,
        titleUz: input.titleUz.trim(),
        descriptionUz: input.descriptionUz?.trim() ?? null,
        isPublished: input.isPublished ?? true,
      },
      select: MODULE_SELECT,
    });
    return toModuleDto(row);
  }

  async update(id: string, input: UpdateModuleInput, actorId: string, roles: string[]): Promise<ModuleDto> {
    const existing = await this.prisma.module.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Modul topilmadi');
    await this.assertCourseOwnership(existing.courseId, actorId, roles);

    if (input.orderIndex !== undefined) {
      const clash = await this.prisma.module.findFirst({
        where: { courseId: existing.courseId, orderIndex: input.orderIndex, NOT: { id } },
      });
      if (clash) throw new ConflictException(`#${input.orderIndex} tartibli modul mavjud`);
    }

    const row = await this.prisma.module.update({
      where: { id },
      data: {
        ...(input.titleUz !== undefined ? { titleUz: input.titleUz.trim() } : {}),
        ...(input.descriptionUz !== undefined
          ? { descriptionUz: input.descriptionUz?.trim() ?? null }
          : {}),
        ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      },
      select: MODULE_SELECT,
    });
    return toModuleDto(row);
  }

  async remove(id: string, actorId: string, roles: string[]): Promise<{
    movedLessonCount: number;
  }> {
    const existing = await this.prisma.module.findUnique({
      where: { id },
      select: { courseId: true, titleUz: true },
    });
    if (!existing) throw new NotFoundException('Modul topilmadi');
    await this.assertCourseOwnership(existing.courseId, actorId, roles);

    // N14: darslarni "Umumiy" modulga ko'chiramiz (yo'q bo'lsa yaratamiz),
    // keyin modulni o'chiramiz. Bitta tranzaksiya.
    const generalName = 'Umumiy';
    const movedLessonCount = await this.prisma.$transaction(async (tx) => {
      let general = await tx.module.findFirst({
        where: { courseId: existing.courseId, titleUz: generalName },
      });
      if (!general) {
        const maxOrder = (
          await tx.module.aggregate({
            where: { courseId: existing.courseId },
            _max: { orderIndex: true },
          })
        )._max.orderIndex;
        general = await tx.module.create({
          data: {
            id: uuidv7(),
            courseId: existing.courseId,
            orderIndex: (maxOrder ?? -1) + 1,
            titleUz: generalName,
            isPublished: true,
          },
        });
      }
      const moved = await tx.lesson.updateMany({
        where: { moduleId: id },
        data: { moduleId: general.id },
      });
      await tx.module.delete({ where: { id } });
      return moved.count;
    });
    return { movedLessonCount };
  }

  /**
   * N14: modul darslarini oldindan ko'rish — nechta dars ta'sirlanadi.
   */
  async removalImpact(id: string, actorId: string, roles: string[]) {
    const existing = await this.prisma.module.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Modul topilmadi');
    await this.assertCourseOwnership(existing.courseId, actorId, roles);
    const lessonCount = await this.prisma.lesson.count({ where: { moduleId: id } });
    return { moduleId: id, lessonsToMove: lessonCount };
  }

  /**
   * Mavjud kurslarga "Umumiy" nomli default modul yaratadi va moduleId=null
   * bo'lgan darslarni unga biriktiradi. Idempotent.
   */
  async backfillDefaultModules(): Promise<{ coursesTouched: number; lessonsLinked: number }> {
    const courses = await this.prisma.course.findMany({
      where: { lessons: { some: { moduleId: null } } },
      select: { id: true },
    });
    let coursesTouched = 0;
    let lessonsLinked = 0;
    for (const c of courses) {
      const existing = await this.prisma.module.findFirst({
        where: { courseId: c.id, titleUz: 'Umumiy' },
      });
      let moduleId = existing?.id;
      if (!moduleId) {
        const next =
          ((
            await this.prisma.module.aggregate({
              where: { courseId: c.id },
              _max: { orderIndex: true },
            })
          )._max.orderIndex ?? -1) + 1;
        const row = await this.prisma.module.create({
          data: {
            id: uuidv7(),
            courseId: c.id,
            orderIndex: next,
            titleUz: 'Umumiy',
            isPublished: true,
          },
        });
        moduleId = row.id;
      }
      const res = await this.prisma.lesson.updateMany({
        where: { courseId: c.id, moduleId: null },
        data: { moduleId },
      });
      coursesTouched += 1;
      lessonsLinked += res.count;
    }
    return { coursesTouched, lessonsLinked };
  }
}
