import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type {
  CreateNewsInput,
  NewsDto,
  NewsQuery,
  UpdateNewsInput,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
};
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

interface Ctx {
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

function sanitize(name: string) {
  return name.replace(/[^\w.\-()Ѐ-ӿ]+/g, '_').slice(0, 200);
}

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: NewsQuery): Promise<{ data: NewsDto[]; meta: { total: number; page: number; perPage: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.NewsWhereInput = {};
    if (query.isPublished !== undefined) where.isPublished = query.isPublished;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.news.count({ where }),
    ]);

    return {
      data: await Promise.all(rows.map((r) => this.toDto(r))),
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findById(id: string): Promise<NewsDto> {
    const row = await this.prisma.news.findUnique({
      where: { id },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!row) throw new NotFoundException('Yangilik topilmadi');
    return this.toDto(row);
  }

  async create(
    input: CreateNewsInput,
    file: Express.Multer.File | undefined,
    ctx: Ctx,
  ): Promise<NewsDto> {
    let attachment: { key: string; fileName: string; mimeType: string; size: number } | null = null;
    if (file) attachment = await this.uploadAttachment(file);

    const id = uuidv7();
    const row = await this.prisma.news.create({
      data: {
        id,
        titleUz: input.titleUz.trim(),
        bodyUz: input.bodyUz.trim(),
        isPublished: input.isPublished,
        publishedAt: input.isPublished ? new Date() : null,
        authorId: ctx.actorId,
        attachmentKey: attachment?.key,
        attachmentFileName: attachment?.fileName,
        attachmentMimeType: attachment?.mimeType,
        attachmentSizeBytes: attachment?.size,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.CREATE,
      subjectType: 'News',
      subjectId: row.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    if (row.isPublished) {
      await this.notifications.broadcast({
        type: 'NEWS_PUBLISHED',
        titleUz: 'Yangi yangilik',
        bodyUz: row.titleUz,
        data: { newsId: row.id },
      });
    }

    return this.toDto(row);
  }

  async update(
    id: string,
    input: UpdateNewsInput,
    file: Express.Multer.File | undefined,
    ctx: Ctx,
  ): Promise<NewsDto> {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Yangilik topilmadi');

    const patch: Prisma.NewsUpdateInput = {};
    if (input.titleUz !== undefined) patch.titleUz = input.titleUz.trim();
    if (input.bodyUz !== undefined) patch.bodyUz = input.bodyUz.trim();

    const wasPublished = existing.isPublished;
    if (input.isPublished !== undefined) {
      patch.isPublished = input.isPublished;
      if (input.isPublished && !wasPublished) patch.publishedAt = new Date();
      if (!input.isPublished) patch.publishedAt = null;
    }

    // Attachment: replace or remove
    if (file) {
      // Delete old first if present
      if (existing.attachmentKey) {
        try {
          await this.storage.delete(existing.attachmentKey);
        } catch {
          // best-effort
        }
      }
      const uploaded = await this.uploadAttachment(file);
      patch.attachmentKey = uploaded.key;
      patch.attachmentFileName = uploaded.fileName;
      patch.attachmentMimeType = uploaded.mimeType;
      patch.attachmentSizeBytes = uploaded.size;
    } else if (input.removeAttachment && existing.attachmentKey) {
      try {
        await this.storage.delete(existing.attachmentKey);
      } catch {
        // best-effort
      }
      patch.attachmentKey = null;
      patch.attachmentFileName = null;
      patch.attachmentMimeType = null;
      patch.attachmentSizeBytes = null;
    }

    const row = await this.prisma.news.update({
      where: { id },
      data: patch,
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.UPDATE,
      subjectType: 'News',
      subjectId: row.id,
      changes: input as Prisma.InputJsonValue,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Notify all users on transition from draft → published
    if (!wasPublished && row.isPublished) {
      await this.notifications.broadcast({
        type: 'NEWS_PUBLISHED',
        titleUz: 'Yangi yangilik',
        bodyUz: row.titleUz,
        data: { newsId: row.id },
      });
    }

    return this.toDto(row);
  }

  async remove(id: string, ctx: Ctx): Promise<{ ok: true; alreadyGone?: true }> {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) return { ok: true, alreadyGone: true };

    if (existing.attachmentKey) {
      try {
        await this.storage.delete(existing.attachmentKey);
      } catch {
        // best-effort
      }
    }

    await this.prisma.news.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'News',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }

  async getAttachmentDownloadUrl(id: string): Promise<{ url: string; fileName: string }> {
    const row = await this.prisma.news.findUnique({ where: { id } });
    if (!row || !row.attachmentKey || !row.attachmentFileName) {
      throw new NotFoundException('Fayl topilmadi');
    }
    const url = await this.storage.getDownloadUrl(row.attachmentKey, row.attachmentFileName);
    return { url, fileName: row.attachmentFileName };
  }

  // ---- helpers -----------------------------------------------------

  private async uploadAttachment(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new UnprocessableEntityException(
        `Fayl turi qo‘llab-quvvatlanmaydi (${file.mimetype}).`,
      );
    }
    if (file.size > MAX_SIZE) {
      throw new UnprocessableEntityException(
        `Fayl juda katta (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks: 20 MB.`,
      );
    }
    const id = uuidv7();
    const safeName = sanitize(file.originalname);
    const key = `news/${id}-${safeName}`;
    await this.storage.upload(key, file.buffer, file.mimetype);
    return { key, fileName: safeName, mimeType: file.mimetype, size: file.size };
  }

  private async toDto(
    row: Prisma.NewsGetPayload<{ include: { author: { select: { firstName: true; lastName: true } } } }>,
  ): Promise<NewsDto> {
    let attachmentUrl: string | null = null;
    if (row.attachmentKey && row.attachmentFileName) {
      // Public presigned URL — brauzer to'g'ridan-to'g'ri yuklab olishi mumkin.
      attachmentUrl = await this.storage.getDownloadUrl(row.attachmentKey, row.attachmentFileName);
    }
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
