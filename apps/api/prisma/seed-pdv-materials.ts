/**
 * PDV kursi materiallarini (ma'ruzalar, amaliy mashg'ulotlar, maxsus
 * topshiriqlar) MinIO + Postgres'ga seed qiladi. Fayl nomidagi raqamga qarab
 * mos darsga biriktiradi; maxsus topshiriqlar kurs sathiga qo'yiladi.
 *
 * Idempotent — har fayl `storageKey` unique bo'ladi. Qayta ishga tushsa,
 * mavjud yozuvlarni o'tkazib yuboradi.
 *
 * Fayllar manbai:
 *   docs/materials/pedagogik/Pedagogik dasturiy vositalar/
 *     ├── Ma'ruzalar/*.docx                   → dars 1..15
 *     ├── Amaliy Mashg'ulotlar/*.docx         → dars 16..22
 *     └── Maxsus topshiriqlar/*.docx          → kurs sathi (lessonId=null)
 *
 * Ishga tushirish:
 *   docker exec eco-api sh -c "cd /workspace/apps/api && pnpm exec tsx prisma/seed-pdv-materials.ts"
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import * as mammoth from 'mammoth';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

const COURSE_SLUG = 'pedagogik-dasturiy-vositalar';
const MATERIALS_DIR =
  process.env.PDV_MATERIALS_DIR ??
  path.resolve(
    __dirname,
    "../../../docs/materials/pedagogik/Pedagogik dasturiy vositalar",
  );
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT ?? 'http://minio:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'ecobalance',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'ecobalance',
  },
});
const BUCKET = process.env.S3_BUCKET_PRIVATE ?? 'ecobalance-private';

function sanitize(name: string) {
  return name.replace(/[^\w.\-()Ѐ-ӿ]+/g, '_').slice(0, 200);
}

interface MaterialSource {
  /** Fayl to'liq yo'li */
  filePath: string;
  /** Foydalanuvchiga ko'rinadigan fayl nomi (asl) */
  originalName: string;
  /** `null` bo'lsa — kurs sathi, aks holda — mos lesson orderIndex. */
  lessonOrder: number | null;
}

/** Fayl nomidan "1 amaliy", "7_maruza", "6_maxsus" raqamini ajratib oladi. */
function extractNumber(name: string): number | null {
  const m = name.match(/^\s*(\d+)/);
  if (!m) return null;
  return Number(m[1]);
}

function listDocx(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    .map((f) => path.join(dir, f));
}

function buildSources(): MaterialSource[] {
  const sources: MaterialSource[] = [];

  // Ma'ruzalar: n_maruza_* → dars n (1..15)
  const lecturesDir = path.join(MATERIALS_DIR, "Ma'ruzalar");
  for (const filePath of listDocx(lecturesDir)) {
    const name = path.basename(filePath);
    // Ma'ruzalar papkasida 7_amaliy_mashgulot ham mavjud — uni tashlab yuboramiz
    // (xuddi shu fayl Amaliy Mashg'ulotlar papkasida ham bor).
    if (/amaliy/i.test(name)) continue;
    const n = extractNumber(name);
    if (!n || n < 1 || n > 15) {
      console.warn(`[skip-lecture] ${name} — ma'ruza raqami aniqlanmadi`);
      continue;
    }
    sources.push({ filePath, originalName: name, lessonOrder: n });
  }

  // Amaliy Mashg'ulotlar: n → dars 15+n (16..22)
  const practicalDir = path.join(MATERIALS_DIR, "Amaliy Mashg'ulotlar");
  for (const filePath of listDocx(practicalDir)) {
    const name = path.basename(filePath);
    const n = extractNumber(name);
    if (!n || n < 1 || n > 7) {
      console.warn(`[skip-practical] ${name} — amaliy raqami aniqlanmadi`);
      continue;
    }
    sources.push({ filePath, originalName: name, lessonOrder: 15 + n });
  }

  // Maxsus topshiriqlar — kurs sathi
  const specialDir = path.join(MATERIALS_DIR, 'Maxsus topshiriqlar');
  for (const filePath of listDocx(specialDir)) {
    sources.push({
      filePath,
      originalName: path.basename(filePath),
      lessonOrder: null,
    });
  }

  return sources;
}

async function extractText(buf: Buffer): Promise<string | null> {
  try {
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value.slice(0, 200_000);
  } catch (err) {
    console.warn('[extractText] failed', err);
    return null;
  }
}

async function main() {
  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) {
    throw new Error(`Course "${COURSE_SLUG}" topilmadi.`);
  }

  const lessons = await prisma.lesson.findMany({
    where: { courseId: course.id },
    select: { id: true, orderIndex: true },
  });
  const lessonByOrder = new Map(lessons.map((l) => [l.orderIndex, l.id]));

  const sources = buildSources();
  console.log(
    `[pdv-materials] ${sources.length} ta fayl topildi. Papka: ${MATERIALS_DIR}`,
  );

  let created = 0;
  let skipped = 0;

  for (const src of sources) {
    const safeName = sanitize(src.originalName);
    const id = uuidv7();
    const storageKey = `materials/${course.id}/${safeName}`; // deterministik — qayta chaqirsa bir xil kalit

    // Mavjud bo'lsa — o'tkazib yuboramiz
    const existing = await prisma.courseMaterial.findUnique({
      where: { storageKey },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const lessonId =
      src.lessonOrder === null ? null : lessonByOrder.get(src.lessonOrder) ?? null;
    if (src.lessonOrder !== null && !lessonId) {
      console.warn(
        `[pdv-materials] dars ${src.lessonOrder} topilmadi — ${src.originalName} kurs sathiga qo'shiladi`,
      );
    }

    const buf = fs.readFileSync(src.filePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        Body: buf,
        ContentType: DOCX_MIME,
      }),
    );

    const contentText = await extractText(buf);

    await prisma.courseMaterial.create({
      data: {
        id,
        courseId: course.id,
        lessonId,
        fileName: safeName,
        storageKey,
        mimeType: DOCX_MIME,
        sizeBytes: buf.length,
        contentText,
      },
    });
    created += 1;

    const target = lessonId ? `dars #${src.lessonOrder}` : 'kurs sathi';
    console.log(`[+] ${safeName} → ${target}`);
  }

  console.log(
    `\n[pdv-materials] tugadi: ${created} ta yangi, ${skipped} ta allaqachon bor edi.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
