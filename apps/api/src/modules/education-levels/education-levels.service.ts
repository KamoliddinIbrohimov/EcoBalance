import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type {
  CreateEducationLevelItemInput,
  EducationLevelItemDto,
  UpdateEducationLevelItemInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestContext {
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

function toDto(row: {
  id: string;
  slug: string;
  nameUz: string;
  descriptionUz: string | null;
  iconName: string;
  orderIndex: number;
  linkedEnum: string | null;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}): EducationLevelItemDto {
  return {
    id: row.id,
    slug: row.slug,
    nameUz: row.nameUz,
    descriptionUz: row.descriptionUz,
    iconName: row.iconName,
    orderIndex: row.orderIndex,
    linkedEnum: (row.linkedEnum ?? null) as EducationLevelItemDto['linkedEnum'],
    isBuiltIn: row.isBuiltIn,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class EducationLevelsService {
  private readonly logger = new Logger(EducationLevelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<EducationLevelItemDto[]> {
    const rows = await this.prisma.educationLevelItem.findMany({
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  }

  async findBySlug(slug: string): Promise<EducationLevelItemDto> {
    const row = await this.prisma.educationLevelItem.findUnique({
      where: { slug: slug.toLowerCase() },
    });
    if (!row) throw new NotFoundException('Ta‘lim darajasi topilmadi');
    return toDto(row);
  }

  async create(
    dto: CreateEducationLevelItemInput,
    ctx: RequestContext,
  ): Promise<EducationLevelItemDto> {
    const slug = dto.slug.trim().toLowerCase();
    const clash = await this.prisma.educationLevelItem.findUnique({ where: { slug } });
    if (clash) throw new ConflictException('Bu slug bilan daraja allaqachon mavjud');

    const row = await this.prisma.educationLevelItem.create({
      data: {
        id: uuidv7(),
        slug,
        nameUz: dto.nameUz.trim(),
        descriptionUz: dto.descriptionUz?.trim() ?? null,
        iconName: dto.iconName || 'GraduationCap',
        orderIndex: dto.orderIndex ?? 0,
        linkedEnum: dto.linkedEnum ?? null,
        isBuiltIn: false,
      },
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'EducationLevelItem',
      subjectId: row.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toDto(row);
  }

  async update(
    id: string,
    dto: UpdateEducationLevelItemInput,
    ctx: RequestContext,
  ): Promise<EducationLevelItemDto> {
    const existing = await this.prisma.educationLevelItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ta‘lim darajasi topilmadi');

    const row = await this.prisma.educationLevelItem.update({
      where: { id },
      data: {
        ...(dto.nameUz !== undefined ? { nameUz: dto.nameUz.trim() } : {}),
        ...(dto.descriptionUz !== undefined
          ? { descriptionUz: dto.descriptionUz?.trim() ?? null }
          : {}),
        ...(dto.iconName !== undefined ? { iconName: dto.iconName } : {}),
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
        ...(dto.linkedEnum !== undefined ? { linkedEnum: dto.linkedEnum } : {}),
      },
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'EducationLevelItem',
      subjectId: id,
      changes: dto as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toDto(row);
  }

  /**
   * Idempotent delete: yozuv mavjud bo'lsa — o'chiradi va audit yozadi.
   * Mavjud bo'lmasa — jim ok qaytaradi (fronda 404 ko'rmasin, brauzerni chetlab
   * o'tgan takroriy tugma bosishlari ham xavfsiz).
   */
  async remove(id: string, ctx: RequestContext) {
    const existing = await this.prisma.educationLevelItem.findUnique({ where: { id } });
    if (!existing) {
      this.logger.debug(`remove: id=${id} allaqachon yo'q, idempotent ok qaytariladi`);
      return { ok: true, alreadyGone: true };
    }

    await this.prisma.educationLevelItem.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'EducationLevelItem',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }
}
