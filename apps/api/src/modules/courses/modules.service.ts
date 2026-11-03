import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateModuleInput, ModuleDto, UpdateModuleInput } from '@eco/shared';

import { AuditService } from '../../infra/audit.service';
import { PrismaService, isUniqueViolation } from '../../infra/prisma.service';
import { type Actor, type ClientInfo, isStudent } from '../auth/actor';
import { COURSE_REF_SELECT, CourseAccess } from './course-access.service';
import { MODULE_SELECT, toModuleDto } from './course.mappers';

const MODULE_NOT_FOUND = 'Modul topilmadi';
/** Modul o'chirilganda uning darslari shu nomli modulga ko'chadi. */
const GENERAL_MODULE = 'Umumiy';

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccess,
    private readonly audit: AuditService,
  ) {}

  async listByCourse(courseId: string, actor: Actor): Promise<ModuleDto[]> {
    await this.access.loadForView(courseId, actor);
    const rows = await this.prisma.module.findMany({
      where: { courseId, ...(isStudent(actor) ? { isPublished: true } : {}) },
      select: MODULE_SELECT,
      orderBy: { orderIndex: 'asc' },
    });
    return rows.map(toModuleDto);
  }

  async create(input: CreateModuleInput, actor: Actor, client: ClientInfo): Promise<ModuleDto> {
    await this.access.loadForManage(input.courseId, actor);
    const orderIndex = input.orderIndex ?? (await this.nextOrder(input.courseId));
    await this.assertOrderFree(input.courseId, orderIndex);
    const row = await this.withOrderConflict(orderIndex, () =>
      this.prisma.module.create({
        data: {
          courseId: input.courseId,
          orderIndex,
          titleUz: input.titleUz.trim(),
          descriptionUz: input.descriptionUz?.trim() ?? null,
          isPublished: input.isPublished,
        },
        select: MODULE_SELECT,
      }),
    );
    await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'Module', subjectId: row.id, ...client });
    return toModuleDto(row);
  }

  async update(id: string, input: UpdateModuleInput, actor: Actor, client: ClientInfo): Promise<ModuleDto> {
    const existing = await this.loadForManage(id, actor);
    if (input.orderIndex !== undefined) await this.assertOrderFree(existing.courseId, input.orderIndex, id);
    const row = await this.withOrderConflict(input.orderIndex ?? 0, () =>
      this.prisma.module.update({
        where: { id },
        data: {
          titleUz: input.titleUz?.trim(),
          descriptionUz: input.descriptionUz === undefined ? undefined : (input.descriptionUz?.trim() ?? null),
          orderIndex: input.orderIndex,
          isPublished: input.isPublished,
        },
        select: MODULE_SELECT,
      }),
    );
    await this.audit.record({ userId: actor.id, action: 'UPDATE', subjectType: 'Module', subjectId: id, changes: input, ...client });
    return toModuleDto(row);
  }

  /**
   * Darslar yo'qolmasligi uchun "Umumiy" modulga ko'chiriladi (kerak bo'lsa
   * yaratiladi). "Umumiy"ning o'zi o'chirilsa — darslar modulsiz qoladi.
   */
  async remove(id: string, actor: Actor, client: ClientInfo): Promise<{ movedLessonCount: number }> {
    const { courseId } = await this.loadForManage(id, actor);
    const movedLessonCount = await this.prisma.$transaction(async (tx) => {
      let general = await tx.module.findFirst({ where: { courseId, titleUz: GENERAL_MODULE }, select: { id: true } });
      if (!general) {
        const max = await tx.module.aggregate({ where: { courseId }, _max: { orderIndex: true } });
        general = await tx.module.create({
          data: { courseId, orderIndex: (max._max.orderIndex ?? -1) + 1, titleUz: GENERAL_MODULE, isPublished: true },
          select: { id: true },
        });
      }
      const moved = await tx.lesson.updateMany({ where: { moduleId: id }, data: { moduleId: general.id === id ? null : general.id } });
      await tx.module.delete({ where: { id } });
      return moved.count;
    });
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'Module', subjectId: id, changes: { movedLessonCount }, ...client });
    return { movedLessonCount };
  }

  private async loadForManage(id: string, actor: Actor) {
    const mod = await this.prisma.module.findUnique({
      where: { id },
      select: { courseId: true, course: { select: COURSE_REF_SELECT } },
    });
    if (!mod) throw new NotFoundException(MODULE_NOT_FOUND);
    this.access.assertCanManage(mod.course, actor, MODULE_NOT_FOUND);
    return mod;
  }

  private async nextOrder(courseId: string) {
    const max = await this.prisma.module.aggregate({ where: { courseId }, _max: { orderIndex: true } });
    return (max._max.orderIndex ?? -1) + 1;
  }

  private async assertOrderFree(courseId: string, orderIndex: number, exceptId?: string) {
    const clash = await this.prisma.module.findFirst({
      where: { courseId, orderIndex, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`#${orderIndex} tartibli modul mavjud`);
  }

  private async withOrderConflict<T>(orderIndex: number, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`#${orderIndex} tartibli modul mavjud`);
      throw err;
    }
  }
}
