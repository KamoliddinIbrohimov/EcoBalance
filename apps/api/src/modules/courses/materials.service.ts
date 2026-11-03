import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import mammoth from 'mammoth';

import { AuditService } from '../../infra/audit.service';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { type Actor, type ClientInfo, isStudent } from '../auth/actor';
import { COURSE_REF_SELECT, CourseAccess, STUDENT_LESSON_WHERE } from './course-access.service';
import { type MaterialDto, toMaterialDto } from './course.mappers';

/** Web klient (features/learning/lib/file-upload.ts) bilan sinxron. */
export const MATERIAL_MAX_BYTES = 30 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'audio/mpeg',
  'video/mp4',
]);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** Chatbot konteksti uchun saqlanadigan matn chegarasi. */
const INDEX_MAX_CHARS = 200_000;
const FILE_NOT_FOUND = 'Fayl topilmadi';

/**
 * Multer fayl nomini latin1 deb o'qiydi — UTF-8 (kirill, o‘) nomlar buziladi.
 * Qayta dekodlash faqat natija toza UTF-8 bo'lsa qabul qilinadi.
 */
function decodeName(raw: string): string {
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  return utf8.includes('�') ? raw : utf8;
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-()Ѐ-ӿ]+/g, '_').slice(0, 200);
}

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccess,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Talabaga yashirin (nashr etilmagan/arxivlangan) darslarning fayllari ko'rsatilmaydi. */
  async listForCourse(courseId: string, actor: Actor): Promise<MaterialDto[]> {
    await this.access.loadForView(courseId, actor);
    const rows = await this.prisma.courseMaterial.findMany({
      where: {
        courseId,
        ...(isStudent(actor) ? { OR: [{ lessonId: null }, { lesson: STUDENT_LESSON_WHERE }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toMaterialDto);
  }

  async upload(
    courseId: string,
    lessonId: string | undefined,
    file: Express.Multer.File | undefined,
    actor: Actor,
    client: ClientInfo,
  ): Promise<MaterialDto> {
    await this.access.loadForManage(courseId, actor);
    if (lessonId) {
      const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, courseId }, select: { id: true } });
      if (!lesson) throw new NotFoundException('Dars topilmadi (bu kursda emas)');
    }
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new UnprocessableEntityException(`Fayl turi qo‘llab-quvvatlanmaydi (${file.mimetype}).`);
    }
    if (file.size > MATERIAL_MAX_BYTES) {
      throw new UnprocessableEntityException(
        `Fayl juda katta (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks: 30 MB.`,
      );
    }

    const fileName = sanitizeName(decodeName(file.originalname));
    const storageKey = `materials/${courseId}/${randomBytes(8).toString('hex')}-${fileName}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    try {
      const row = await this.prisma.courseMaterial.create({
        data: {
          courseId,
          lessonId: lessonId ?? null,
          fileName,
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedBy: actor.id,
          contentText: await this.extractText(file),
        },
      });
      await this.audit.record({ userId: actor.id, action: 'CREATE', subjectType: 'CourseMaterial', subjectId: row.id, ...client });
      return toMaterialDto(row);
    } catch (err) {
      // DB yozilmasa fayl yetim qolmasin.
      await this.storage.remove(storageKey);
      throw err;
    }
  }

  async downloadUrl(id: string, actor: Actor): Promise<{ url: string; fileName: string }> {
    const row = await this.prisma.courseMaterial.findUnique({
      where: { id },
      select: {
        storageKey: true,
        fileName: true,
        lessonId: true,
        course: { select: COURSE_REF_SELECT },
        lesson: { select: { id: true, moduleId: true, isPublished: true, archivedAt: true } },
      },
    });
    if (!row) throw new NotFoundException(FILE_NOT_FOUND);
    await this.access.assertCanView(row.course, actor, FILE_NOT_FOUND);
    if (isStudent(actor) && row.lesson) {
      if (!row.lesson.isPublished || row.lesson.archivedAt) throw new NotFoundException(FILE_NOT_FOUND);
      if (!(await this.access.isLessonOpenFor(actor, row.lesson))) throw new NotFoundException(FILE_NOT_FOUND);
    }
    return { url: await this.storage.downloadUrl(row.storageKey, row.fileName), fileName: row.fileName };
  }

  async remove(id: string, actor: Actor, client: ClientInfo) {
    const row = await this.prisma.courseMaterial.findUnique({
      where: { id },
      select: { storageKey: true, course: { select: COURSE_REF_SELECT } },
    });
    if (!row) throw new NotFoundException(FILE_NOT_FOUND);
    this.access.assertCanManage(row.course, actor, FILE_NOT_FOUND);
    await this.prisma.courseMaterial.delete({ where: { id } });
    await this.storage.remove(row.storageKey);
    await this.audit.record({ userId: actor.id, action: 'DELETE', subjectType: 'CourseMaterial', subjectId: id, ...client });
    return { ok: true };
  }

  /** Chatbot RAG uchun matn: txt/csv to'g'ridan-to'g'ri, docx — mammoth. Xato yuklashni to'xtatmaydi. */
  private async extractText(file: Express.Multer.File): Promise<string | null> {
    // Postgres TEXT NUL belgini qabul qilmaydi — butun yuklash yiqilmasin.
    const clean = (s: string) => s.replaceAll('\u0000', '').slice(0, INDEX_MAX_CHARS);
    try {
      if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
        return clean(file.buffer.toString('utf8'));
      }
      if (file.mimetype === DOCX_MIME) {
        return clean((await mammoth.extractRawText({ buffer: file.buffer })).value);
      }
    } catch (err) {
      this.logger.warn({ err, file: file.originalname }, 'Fayldan matn ajratilmadi');
    }
    return null;
  }
}
