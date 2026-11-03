/**
 * Oliy ta'lim ekologiya darslariga manba docx fayllarini biriktiradi
 * (prisma/data/files/ekologiya → MinIO private bucket + course_materials).
 * Darsda shu nomli fayl bo'lsa o'tkazib yuboriladi — qayta ishga tushirish xavfsiz.
 */
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '@prisma/client';
import mammoth from 'mammoth';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const INDEX_MAX_CHARS = 200_000;
const FILES_DIR = join(__dirname, 'files', 'ekologiya');

const FILES = [
  ...Array.from({ length: 9 }, (_, i) => ({
    courseSlug: 'ekologiya-asoslari',
    orderIndex: i + 1,
    fileName: `Ekologiya_asoslari_${i + 1}-mashgulot.docx`,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    courseSlug: 'ozbekiston-tabiati-va-siyosati',
    orderIndex: i + 1,
    fileName: `Ozbekiston_tabiati_${i + 1}-mashgulot.docx`,
  })),
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

export async function importEkologiyaFayllar(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const { client, bucket } = s3();
  let attached = 0;
  for (const f of FILES) {
    const lesson = await prisma.lesson.findFirst({
      where: { course: { slug: f.courseSlug }, orderIndex: f.orderIndex, archivedAt: null },
      select: { id: true, courseId: true, materials: { select: { fileName: true } } },
    });
    if (!lesson || lesson.materials.some((m) => m.fileName === f.fileName)) continue;

    const body = await readFile(join(FILES_DIR, f.fileName));
    const text = (await mammoth.extractRawText({ buffer: body })).value.replaceAll('\u0000', '');
    const storageKey = `materials/${lesson.courseId}/${randomBytes(8).toString('hex')}-${f.fileName}`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: body, ContentType: DOCX_MIME }));
    try {
      await prisma.courseMaterial.create({
        data: {
          courseId: lesson.courseId,
          lessonId: lesson.id,
          fileName: f.fileName,
          storageKey,
          mimeType: DOCX_MIME,
          sizeBytes: body.length,
          contentText: text.slice(0, INDEX_MAX_CHARS),
        },
      });
    } catch (err) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })).catch(() => undefined);
      throw err;
    }
    attached += 1;
  }
  log(`✓ Ekologiya darslariga ${attached} ta fayl biriktirildi`);
  return true;
}
