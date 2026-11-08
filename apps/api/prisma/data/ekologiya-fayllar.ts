/**
 * Oliy ta'lim darslariga fayl biriktirish (prisma/data/files → MinIO private
 * bucket + course_materials): ekologiya darslarining manba docx'lari va video darsliklar.
 * Darsda shu nomli fayl bo'lsa o'tkazib yuboriladi — qayta ishga tushirish xavfsiz.
 */
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '@prisma/client';
import mammoth from 'mammoth';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MP4_MIME = 'video/mp4';
const INDEX_MAX_CHARS = 200_000;
const FILES_ROOT = join(__dirname, 'files');

interface LessonFile {
  courseSlug: string;
  orderIndex: number;
  /** prisma/data/files ichidagi yo'l; fayl nomi materialda shunday ko'rinadi. */
  path: string;
  mimeType: string;
}

const EKOLOGIYA_DOCX: LessonFile[] = [
  ...Array.from({ length: 9 }, (_, i) => ({
    courseSlug: 'ekologiya-asoslari',
    orderIndex: i + 1,
    path: `ekologiya/Ekologiya_asoslari_${i + 1}-mashgulot.docx`,
    mimeType: DOCX_MIME,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    courseSlug: 'ozbekiston-tabiati-va-siyosati',
    orderIndex: i + 1,
    path: `ekologiya/Ozbekiston_tabiati_${i + 1}-mashgulot.docx`,
    mimeType: DOCX_MIME,
  })),
];

const VIDEO_DARSLIKLAR: LessonFile[] = [
  {
    courseSlug: 'ekologiya-asoslari',
    orderIndex: 5,
    path: 'video/5-dars_Qishloq_xojaligi_va_biosfera.mp4',
    mimeType: MP4_MIME,
  },
];

function s3() {
  const env = process.env;
  return {
    bucket: env.S3_BUCKET_PRIVATE ?? 'ecobalance-private',
    client: new S3Client({
      region: env.S3_REGION ?? 'us-east-1',
      endpoint: env.S3_ENDPOINT ?? 'http://minio:9000',
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY ?? 'ecobalance',
        secretAccessKey: env.S3_SECRET_KEY ?? 'ecobalance',
      },
    }),
  };
}

/** Nechta fayl biriktirilganini qaytaradi. */
/**
 * Nechta fayl biriktirilganini qaytaradi. `replace` — shu nomli eski material bo'lsa,
 * yangisi yozilgach eskisi (qator + MinIO obyekti) o'chiriladi.
 */
async function attachLessonFiles(prisma: PrismaClient, files: LessonFile[], replace = false) {
  const { client, bucket } = s3();
  let attached = 0;
  for (const f of files) {
    const fileName = f.path.split('/').pop()!;
    const lesson = await prisma.lesson.findFirst({
      where: { course: { slug: f.courseSlug }, orderIndex: f.orderIndex, archivedAt: null },
      select: { id: true, courseId: true, materials: { select: { id: true, fileName: true, storageKey: true } } },
    });
    if (!lesson) continue;
    const old = lesson.materials.filter((m) => m.fileName === fileName);
    if (old.length && !replace) continue;

    const body = await readFile(join(FILES_ROOT, f.path));
    const text =
      f.mimeType === DOCX_MIME
        ? (await mammoth.extractRawText({ buffer: body })).value.replaceAll('\u0000', '').slice(0, INDEX_MAX_CHARS)
        : null;
    const storageKey = `materials/${lesson.courseId}/${randomBytes(8).toString('hex')}-${fileName}`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: body, ContentType: f.mimeType }));
    try {
      await prisma.courseMaterial.create({
        data: {
          courseId: lesson.courseId,
          lessonId: lesson.id,
          fileName,
          storageKey,
          mimeType: f.mimeType,
          sizeBytes: body.length,
          contentText: text,
        },
      });
    } catch (err) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })).catch(() => undefined);
      throw err;
    }
    for (const m of old) {
      await prisma.courseMaterial.delete({ where: { id: m.id } });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: m.storageKey })).catch(() => undefined);
    }
    attached += 1;
  }
  return attached;
}

export async function importEkologiyaFayllar(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const n = await attachLessonFiles(prisma, EKOLOGIYA_DOCX);
  log(`✓ Ekologiya darslariga ${n} ta fayl biriktirildi`);
  return true;
}

/** `replace` — video qayta tayyorlanganda eski nusxa yangisiga almashtiriladi. */
export async function importVideoDarsliklar(
  prisma: PrismaClient,
  { replace = false }: { replace?: boolean } = {},
  log: (msg: string) => void = console.log,
) {
  const n = await attachLessonFiles(prisma, VIDEO_DARSLIKLAR, replace);
  log(`✓ Video darsliklar: ${n} ta video ${replace ? 'yangilandi' : 'biriktirildi'}`);
  return true;
}
