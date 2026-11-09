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

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const HTML_MIME = 'text/html';
const MP4_MIME = 'video/mp4';
const INDEX_MAX_CHARS = 200_000;
const FILES_ROOT = join(__dirname, 'files');

export interface LessonFile {
  courseSlug: string;
  /** null — kurs sathidagi material (darsga bog'lanmagan). */
  orderIndex: number | null;
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

/**
 * Ikkinchi to'plam (2026-11-08). Fayllar git'da emas (~90 MB): serverda
 * /opt/eco-balance/video-import ga yuklanib, seed bir marta shu papka
 * files/video2 sifatida ulangan holda ishga tushiriladi. Fayl topilmasa import
 * yiqiladi, belgi qo'yilmaydi va keyingi ishga tushishda qayta urinadi.
 */
const VIDEO_DARSLIKLAR_2: LessonFile[] = [
  ['ekologiya-asoslari', 6, '6-dars_Suv_muhitiga_moslashish.mp4'],
  ['ekologiya-asoslari', 7, '7-dars_Tuproq_muhitiga_moslashish.mp4'],
  ['ekologiya-asoslari', 8, '8-dars_Shaharlarda_shovqin.mp4'],
  ['ekologiya-asoslari', 9, '9-dars_Biosfera_chegaralari.mp4'],
  ['ozbekiston-tabiati-va-siyosati', 1, '1-dars_Orol_boyi_muammolari.mp4'],
  ['ozbekiston-tabiati-va-siyosati', 3, '3-dars_Hayvonot_olamini_muhofaza_qilish.mp4'],
  ['ozbekiston-tabiati-va-siyosati', 4, '4-dars_Osimlik_qoplamini_muhofaza_qilish.mp4'],
].map(([courseSlug, orderIndex, file]) => ({
  courseSlug: courseSlug as string,
  orderIndex: orderIndex as number,
  path: `video2/${file}`,
  mimeType: MP4_MIME,
}));

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

/** Chatbot qidiruvi uchun matn: docx — mammoth, html — teglarsiz matn. */
async function extractText(body: Buffer, mimeType: string): Promise<string | null> {
  let text: string | null = null;
  if (mimeType === DOCX_MIME) text = (await mammoth.extractRawText({ buffer: body })).value;
  else if (mimeType === HTML_MIME) {
    text = body
      .toString('utf8')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ');
  }
  return text ? text.replaceAll('\u0000', '').trim().slice(0, INDEX_MAX_CHARS) : null;
}

/**
 * Nechta fayl biriktirilganini qaytaradi. `orderIndex: null` — kursning umumiy
 * materiali (darsga bog'lanmagan). `replace` — shu nomli eski material bo'lsa,
 * yangisi yozilgach eskisi (qator + MinIO obyekti) o'chiriladi.
 */
export async function attachLessonFiles(prisma: PrismaClient, files: LessonFile[], replace = false) {
  const { client, bucket } = s3();
  let attached = 0;
  for (const f of files) {
    const fileName = f.path.split('/').pop()!;
    const materialSelect = { select: { id: true, fileName: true, storageKey: true, lessonId: true } } as const;
    let target: { courseId: string; lessonId: string | null; materials: { id: string; fileName: string; storageKey: string }[] } | null = null;
    if (f.orderIndex === null) {
      const course = await prisma.course.findUnique({ where: { slug: f.courseSlug }, select: { id: true, materials: materialSelect } });
      if (course) target = { courseId: course.id, lessonId: null, materials: course.materials.filter((m) => m.lessonId === null) };
    } else {
      const lesson = await prisma.lesson.findFirst({
        where: { course: { slug: f.courseSlug }, orderIndex: f.orderIndex, archivedAt: null },
        select: { id: true, courseId: true, materials: materialSelect },
      });
      if (lesson) target = { courseId: lesson.courseId, lessonId: lesson.id, materials: lesson.materials };
    }
    if (!target) continue;
    const old = target.materials.filter((m) => m.fileName === fileName);
    if (old.length && !replace) continue;

    const body = await readFile(join(FILES_ROOT, f.path));
    const text = await extractText(body, f.mimeType);
    const storageKey = `materials/${target.courseId}/${randomBytes(8).toString('hex')}-${fileName}`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: body, ContentType: f.mimeType }));
    try {
      await prisma.courseMaterial.create({
        data: {
          courseId: target.courseId,
          lessonId: target.lessonId,
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

/** `only` — faqat shu fayllar (masalan, qayta tayyorlangan videolar `replace` bilan almashtiriladi). */
export async function importVideoDarsliklar2(
  prisma: PrismaClient,
  { replace = false, only }: { replace?: boolean; only?: string[] } = {},
  log: (msg: string) => void = console.log,
) {
  const files = only ? VIDEO_DARSLIKLAR_2.filter((f) => only.some((name) => f.path.endsWith(name))) : VIDEO_DARSLIKLAR_2;
  const n = await attachLessonFiles(prisma, files, replace);
  log(`✓ Video darsliklar (2-to'plam): ${n} ta video ${replace ? 'yangilandi' : 'biriktirildi'}`);
  return true;
}
