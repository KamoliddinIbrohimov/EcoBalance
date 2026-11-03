import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EcoReportDto, EcoReportQuery, NewsDto, NewsQuery } from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { type Actor, isAdmin } from '../auth/actor';

const ECO_SELECT = {
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

const NEWS_INCLUDE = { author: { select: { firstName: true, lastName: true } } } satisfies Prisma.NewsInclude;

type EcoRow = Prisma.EcoReportGetPayload<{ select: typeof ECO_SELECT }>;
type NewsRow = Prisma.NewsGetPayload<{ include: typeof NEWS_INCLUDE }>;

/**
 * Eski (yozish to'xtatilgan) kontent: eko-murojaatlar va yangiliklar faqat
 * o'qiladi. Yangi yozuvlar yaratilmaydi — ma'lumot tarixiy.
 */
@Injectable()
export class LegacyContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async ecoReports(q: EcoReportQuery) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.EcoReportWhereInput = {
      category: q.category,
      status: q.status,
      organizationId: q.organizationId,
      OR: q.search
        ? [
            { descriptionUz: { contains: q.search, mode: 'insensitive' } },
            { locationLabel: { contains: q.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ecoReport.count({ where }),
      this.prisma.ecoReport.findMany({ where, select: ECO_SELECT, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return toPage(rows.map(toEcoDto), total, page, perPage);
  }

  /** Qoralamalarni faqat SA ko'radi; boshqalar uchun `isPublished` filtri majburan true. */
  async news(q: NewsQuery, actor: Actor) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.NewsWhereInput = { isPublished: isAdmin(actor) ? q.isPublished : true };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.news.count({ where }),
      this.prisma.news.findMany({
        where,
        include: NEWS_INCLUDE,
        orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return toPage(await Promise.all(rows.map((r) => this.toNewsDto(r))), total, page, perPage);
  }

  async newsItem(id: string, actor: Actor) {
    const row = await this.prisma.news.findUnique({ where: { id }, include: NEWS_INCLUDE });
    if (!row || (!row.isPublished && !isAdmin(actor))) throw new NotFoundException('Yangilik topilmadi');
    return this.toNewsDto(row);
  }

  private async toNewsDto(row: NewsRow): Promise<NewsDto> {
    const attachmentUrl =
      row.attachmentKey && row.attachmentFileName
        ? await this.storage.downloadUrl(row.attachmentKey, row.attachmentFileName, 3600)
        : null;
    return {
      id: row.id,
      titleUz: row.titleUz,
      bodyUz: row.bodyUz,
      attachmentUrl,
      attachmentFileName: row.attachmentFileName,
      attachmentMimeType: row.attachmentMimeType,
      attachmentSizeBytes: row.attachmentSizeBytes,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      authorName: row.author ? `${row.author.firstName} ${row.author.lastName}` : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function toEcoDto(row: EcoRow): EcoReportDto {
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
