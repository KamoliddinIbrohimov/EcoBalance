import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AuditService } from '../auth/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface MaterialDto {
  id: string;
  courseId: string;
  lessonId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

const ALLOWED_MIME: Record<string, string> = {
  // Hujjatlar
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/rtf': '.rtf',
  'text/plain': '.txt',
  // Elektron jadvallar
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
  // Taqdimotlar
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  // Rasmlar
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  // Arxivlar
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/vnd.rar': '.rar',
  'application/x-7z-compressed': '.7z',
  // Media (kichik)
  'audio/mpeg': '.mp3',
  'video/mp4': '.mp4',
};
const MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

function sanitize(name: string) {
  return name.replace(/[^\w.\-()Ѐ-ӿ]+/g, '_').slice(0, 200);
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Fayldan matn indeksini chiqarish — chatbot RAG uchun.
   * docx: mammoth orqali. txt/md/csv: to'g'ridan-to'g'ri.
   * Rasm/pdf/arxiv: hozircha qo'llab-quvvatlanmaydi (null).
   */
  private async extractTextForIndex(file: Express.Multer.File): Promise<string | null> {
    try {
      if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
        return file.buffer.toString('utf-8').slice(0, 200_000);
      }
      if (file.mimetype === DOCX_MIME) {
        // mammoth async load — apps/api dan tashqarida (root node_modules)
        const mammoth: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> } =
          (await import('mammoth')) as never;
        const res = await mammoth.extractRawText({ buffer: file.buffer });
        return res.value.slice(0, 200_000);
      }
      return null;
    } catch (err) {
      // Extraction xatosi upload'ni to'xtatmasin — indeks bo'lmasa ham fayl saqlanadi.
      // eslint-disable-next-line no-console
      console.error('extractTextForIndex failed:', err);
      return null;
    }
  }

  async listForCourse(
    courseId: string,
    actor?: { id: string; roles: string[] },
  ): Promise<MaterialDto[]> {
    // N1: faqat egalikka ega yoki guruhidagi talaba ko'ra oladi.
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, ownerId: true, visibility: true, isPublished: true },
    });
    if (!course) throw new NotFoundException('Kurs topilmadi');

    if (actor) {
      const isSA = actor.roles.includes('SUPER_ADMIN');
      const isTeacher = actor.roles.includes('TEACHER') && !isSA;
      const isStudent = !isSA && !isTeacher;
      if (isTeacher) {
        if (course.ownerId !== actor.id && course.visibility !== 'LIBRARY') {
          throw new NotFoundException('Kurs topilmadi');
        }
      } else if (isStudent) {
        if (!course.isPublished) throw new NotFoundException('Kurs topilmadi');
        const member = await this.prisma.groupMember.findUnique({
          where: { studentId: actor.id },
          select: { groupId: true, group: { select: { isActive: true } } },
        });
        if (!member || !member.group.isActive) throw new NotFoundException('Kurs topilmadi');
        const link = await this.prisma.courseGroup.findUnique({
          where: { courseId_groupId: { courseId, groupId: member.groupId } },
          select: { courseId: true },
        });
        if (!link) throw new NotFoundException('Kurs topilmadi');
      }
    }

    const rows = await this.prisma.courseMaterial.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      lessonId: r.lessonId,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      uploadedBy: r.uploadedBy,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async upload(params: {
    courseId: string;
    lessonId?: string;
    file: Express.Multer.File;
    actorId?: string;
    actorRoles?: string[];
    ip?: string;
    userAgent?: string;
  }): Promise<MaterialDto> {
    const { courseId, lessonId, file, actorId, actorRoles = [], ip, userAgent } = params;

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Kurs topilmadi');

    // N1: faqat SA yoki kurs egasi fayl yuklashi mumkin
    const isSA = actorRoles.includes('SUPER_ADMIN');
    if (!isSA && course.ownerId !== actorId) {
      throw new ForbiddenException("Faqat o'z kursingizga fayl yuklay olasiz");
    }

    if (lessonId) {
      const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, courseId } });
      if (!lesson) throw new NotFoundException('Dars topilmadi (bu kursda emas)');
    }

    if (!file) throw new BadRequestException('Fayl yuborilmagan');

    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new UnprocessableEntityException(
        `Fayl turi qo‘llab-quvvatlanmaydi (${file.mimetype}).`,
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new UnprocessableEntityException(
        `Fayl juda katta (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks: 30 MB.`,
      );
    }

    const id = uuidv7();
    const safeName = sanitize(file.originalname);
    const key = `materials/${courseId}/${id}-${safeName}`;

    await this.storage.upload(key, file.buffer, file.mimetype);

    // Chatbot uchun matn indeksini olib qo'yamiz — docx va txt formatlarida
    // qo'llab-quvvatlanadi. Boshqa formatlar uchun contentText null.
    const contentText = await this.extractTextForIndex(file);

    const row = await this.prisma.courseMaterial.create({
      data: {
        id,
        courseId,
        lessonId: lessonId ?? null,
        fileName: safeName,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: actorId ?? null,
        contentText,
      },
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      subjectType: 'CourseMaterial',
      subjectId: row.id,
      ipAddress: ip,
      userAgent,
    });

    return {
      id: row.id,
      courseId: row.courseId,
      lessonId: row.lessonId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getDownloadUrl(
    id: string,
    actor?: { id: string; roles: string[] },
  ): Promise<{ url: string; fileName: string }> {
    const row = await this.prisma.courseMaterial.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, ownerId: true, visibility: true, isPublished: true } },
        lesson: { select: { isPublished: true, archivedAt: true } },
      },
    });
    if (!row) throw new NotFoundException('Fayl topilmadi');

    if (actor) {
      const isSA = actor.roles.includes('SUPER_ADMIN');
      const isTeacher = actor.roles.includes('TEACHER') && !isSA;
      const isStudent = !isSA && !isTeacher;
      if (isTeacher) {
        if (row.course.ownerId !== actor.id && row.course.visibility !== 'LIBRARY') {
          throw new NotFoundException('Fayl topilmadi');
        }
      } else if (isStudent) {
        if (!row.course.isPublished) throw new NotFoundException('Fayl topilmadi');
        if (row.lesson && (!row.lesson.isPublished || row.lesson.archivedAt)) {
          throw new NotFoundException('Fayl topilmadi');
        }
        const member = await this.prisma.groupMember.findUnique({
          where: { studentId: actor.id },
          select: { groupId: true, group: { select: { isActive: true } } },
        });
        if (!member || !member.group.isActive) throw new NotFoundException('Fayl topilmadi');
        const link = await this.prisma.courseGroup.findUnique({
          where: { courseId_groupId: { courseId: row.courseId, groupId: member.groupId } },
          select: { courseId: true },
        });
        if (!link) throw new NotFoundException('Fayl topilmadi');
        // Agar lesson bo'lsa — release tekshiradi
        if (row.lessonId) {
          const lessonRelease = await this.prisma.groupLessonRelease.findFirst({
            where: { groupId: member.groupId, lessonId: row.lessonId },
          });
          if (lessonRelease) {
            const now = Date.now();
            const open =
              lessonRelease.status === 'OPEN' ||
              (lessonRelease.status === 'SCHEDULED' &&
                lessonRelease.opensAt &&
                lessonRelease.opensAt.getTime() <= now);
            if (!open) throw new NotFoundException('Fayl topilmadi');
          }
        }
      }
    }

    const url = await this.storage.getDownloadUrl(row.storageKey, row.fileName);
    return { url, fileName: row.fileName };
  }

  async remove(
    id: string,
    ctx: { actorId?: string; actorRoles?: string[]; ip?: string; userAgent?: string },
  ) {
    const row = await this.prisma.courseMaterial.findUnique({
      where: { id },
      include: { course: { select: { ownerId: true } } },
    });
    if (!row) throw new NotFoundException('Fayl topilmadi');

    const isSA = (ctx.actorRoles ?? []).includes('SUPER_ADMIN');
    if (!isSA && row.course.ownerId !== ctx.actorId) {
      throw new ForbiddenException("Faqat o'z kursingiz faylini o'chira olasiz");
    }

    try {
      await this.storage.delete(row.storageKey);
    } catch {
      // If S3 delete fails, still remove DB row to avoid orphan references.
    }

    await this.prisma.courseMaterial.delete({ where: { id } });

    await this.audit.record({
      userId: ctx.actorId,
      action: AuditAction.DELETE,
      subjectType: 'CourseMaterial',
      subjectId: id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  }
}
