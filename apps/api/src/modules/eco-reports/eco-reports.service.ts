import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type {
  CreateEcoReportInput,
  EcoReportDto,
  EcoReportQuery,
  UpdateEcoReportStatusInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestContext {
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

const SELECT = {
  id: true,
  organizationId: true,
  reportedBy: true,
  reporter: { select: { firstName: true, lastName: true } },
  category: true,
  riskLevel: true,
  status: true,
  descriptionUz: true,
  suggestionUz: true,
  latitude: true,
  longitude: true,
  locationLabel: true,
  photoBeforeKey: true,
  photoAfterKey: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EcoReportSelect;

type Row = Prisma.EcoReportGetPayload<{ select: typeof SELECT }>;

function toDto(row: Row): EcoReportDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    reportedBy: row.reportedBy,
    reporterName: row.reporter ? `${row.reporter.firstName} ${row.reporter.lastName}` : null,
    category: row.category,
    riskLevel: row.riskLevel,
    status: row.status,
    descriptionUz: row.descriptionUz,
    suggestionUz: row.suggestionUz,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    locationLabel: row.locationLabel,
    photoBeforeKey: row.photoBeforeKey,
    photoAfterKey: row.photoAfterKey,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class EcoReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: EcoReportQuery) {
    const { page, perPage, search, category, status, organizationId } = query;

    const where: Prisma.EcoReportWhereInput = {
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(search
        ? {
            OR: [
              { descriptionUz: { contains: search, mode: 'insensitive' as const } },
              { locationLabel: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ecoReport.count({ where }),
      this.prisma.ecoReport.findMany({
        where,
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findById(id: string): Promise<EcoReportDto> {
    const row = await this.prisma.ecoReport.findUnique({ where: { id }, select: SELECT });
    if (!row) throw new NotFoundException('Murojaat topilmadi');
    return toDto(row);
  }

  async create(
    dto: CreateEcoReportInput,
    ctx: RequestContext & { actorId: string },
  ): Promise<EcoReportDto> {
    const row = await this.prisma.ecoReport.create({
      data: {
        id: uuidv7(),
        organizationId: dto.organizationId ?? null,
        reportedBy: ctx.actorId,
        category: dto.category,
        riskLevel: dto.riskLevel,
        descriptionUz: dto.descriptionUz.trim(),
        suggestionUz: dto.suggestionUz?.trim() ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        locationLabel: dto.locationLabel?.trim() ?? null,
      },
      select: SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'EcoReport',
      subjectId: row.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toDto(row);
  }

  async updateStatus(
    id: string,
    dto: UpdateEcoReportStatusInput,
    ctx: RequestContext,
  ): Promise<EcoReportDto> {
    const existing = await this.prisma.ecoReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Murojaat topilmadi');

    const row = await this.prisma.ecoReport.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt: dto.status === 'RESOLVED' ? new Date() : null,
      },
      select: SELECT,
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'EcoReport',
      subjectId: id,
      changes: { status: dto.status } as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return toDto(row);
  }

  async remove(id: string, ctx: RequestContext) {
    const existing = await this.prisma.ecoReport.findUnique({ where: { id } });
    if (!existing) return { ok: true, alreadyGone: true };

    await this.prisma.ecoReport.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'EcoReport',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }

  /**
   * Statistika Dashboard/Reports/Analytics uchun — toifa/status jamlash.
   */
  async stats() {
    const [byCategory, byStatus, total] = await this.prisma.$transaction([
      this.prisma.ecoReport.groupBy({
        by: ['category'],
        _count: { _all: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.ecoReport.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.ecoReport.count(),
    ]);

    return {
      total,
      byCategory: byCategory.map((r) => ({
        category: r.category,
        count: (r._count as { _all: number })._all,
      })),
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: (r._count as { _all: number })._all,
      })),
    };
  }
}
