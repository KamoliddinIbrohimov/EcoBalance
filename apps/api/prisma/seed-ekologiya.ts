/**
 * Ekologiya darslarini (docs/materials/ekologiya/*.docx) `Course` + `Lesson`
 * jadvallariga tushiruvchi seed skript.
 *
 * Run: `pnpm --filter @eco/api prisma:seed:ekologiya`
 *
 * Idempotent — kurs slug + (courseId, orderIndex) bo'yicha upsert.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { PrismaClient, LessonType, EducationLevel } from '@prisma/client';
import * as mammoth from 'mammoth';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

const MATERIALS_DIR = path.resolve(__dirname, '../../../docs/materials/ekologiya');

// ---------------------------------------------------------------
// Manual mapping — 15 fayl → tartib nomer + kurs biriktirilishi
// ---------------------------------------------------------------

interface LessonSource {
  order: number;
  fileName: string;
  courseSlug: 'ekologiya-asoslari' | 'ozbekiston-tabiati-va-siyosati';
  lessonType: LessonType;
  fallbackTitle: string;
}

const LESSONS: LessonSource[] = [
  { order: 1,  fileName: 'ekologiya (kunduzgi) 1.docx', courseSlug: 'ekologiya-asoslari', lessonType: LessonType.AMALIY, fallbackTitle: 'Ekologiyaning bo‘limlari va tuzilishi' },
  { order: 2,  fileName: 'экология 2.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.AMALIY, fallbackTitle: 'Ekologiyada qo‘llaniladigan tadqiqot usullari' },
  { order: 3,  fileName: 'экология 3.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.LABORATORIYA, fallbackTitle: 'Xonaning ekologik pasportini tuzish' },
  { order: 4,  fileName: 'экология 4.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.AMALIY, fallbackTitle: 'Inson va tabiiy landshaftlar' },
  { order: 5,  fileName: 'экология 5.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.AMALIY, fallbackTitle: 'Qishloq xo‘jaligi va biosfera' },
  { order: 6,  fileName: 'экология 6.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.LABORATORIYA, fallbackTitle: 'Suv muhiti omillariga organizmlarning moslashishi' },
  { order: 7,  fileName: 'экология 7.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.LABORATORIYA, fallbackTitle: 'Tuproq muhiti omillariga organizmlarning moslashishi' },
  { order: 8,  fileName: 'экология 8.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.AMALIY, fallbackTitle: 'Shovqin: shaharlarda shovqin muammosi' },
  { order: 9,  fileName: 'экология 9.docx',              courseSlug: 'ekologiya-asoslari', lessonType: LessonType.AMALIY, fallbackTitle: 'Biosfera chegaralari va organizmlarning tarqalishi' },
  { order: 1,  fileName: 'экология 10.docx',             courseSlug: 'ozbekiston-tabiati-va-siyosati', lessonType: LessonType.AMALIY, fallbackTitle: 'Orol bo‘yi muammolari va bugungi ahvoli' },
  { order: 2,  fileName: 'экология 11.docx',             courseSlug: 'ozbekiston-tabiati-va-siyosati', lessonType: LessonType.AMALIY, fallbackTitle: 'O‘zbekiston tabiat yodgorliklari' },
  { order: 3,  fileName: 'экология 12.docx',             courseSlug: 'ozbekiston-tabiati-va-siyosati', lessonType: LessonType.AMALIY, fallbackTitle: 'Hayvonot olamini muhofaza qilish — milliy bog‘lar va buyurtmaxonalar' },
  { order: 4,  fileName: 'экология 13.docx',             courseSlug: 'ozbekiston-tabiati-va-siyosati', lessonType: LessonType.AMALIY, fallbackTitle: 'O‘simlik qoplamini muhofaza qilish — qo‘riqxonalar' },
  { order: 5,  fileName: 'экология 14.docx',             courseSlug: 'ozbekiston-tabiati-va-siyosati', lessonType: LessonType.AMALIY, fallbackTitle: 'O‘zbekistonning hozirgi ekologik siyosati' },
  { order: 6,  fileName: 'экология 15.docx',             courseSlug: 'ozbekiston-tabiati-va-siyosati', lessonType: LessonType.EKSKURSIYA, fallbackTitle: 'Hayvonot va botanika bog‘iga ekskursiya' },
];

const COURSES: Record<LessonSource['courseSlug'], { nameUz: string; descriptionUz: string }> = {
  'ekologiya-asoslari': {
    nameUz: 'Ekologiya asoslari',
    descriptionUz:
      'Ekologiya fanining asosiy bo‘limlari, tadqiqot usullari, muhit omillari va organizmlarning moslashishi bo‘yicha 9 ta amaliy va laboratoriya mashg‘uloti.',
  },
  'ozbekiston-tabiati-va-siyosati': {
    nameUz: 'O‘zbekiston tabiati va ekologik siyosati',
    descriptionUz:
      'Orolbo‘yi muammolari, milliy bog‘lar va qo‘riqxonalar, hayvonot va o‘simlik dunyosini muhofaza qilish hamda O‘zbekiston ekologik siyosati bo‘yicha 6 ta mashg‘ulot va ekskursiya.',
  },
};

// ---------------------------------------------------------------
// Docx parser — mavzu / maqsad / jihozlar / nazariya / topshiriqlar
// ---------------------------------------------------------------

interface ParsedLesson {
  title: string | null;
  objective: string | null;
  equipment: string | null;
  theory: string | null;
  procedure: string[];
}

/** "Header: value" ko'rinishidagi qatordan value'ni ajratib oladi. */
function extractFieldValue(text: string, header: RegExp): string | null {
  const m = text.match(header);
  if (!m) return null;
  const idx = m.index! + m[0].length;
  const rest = text.slice(idx);
  const nextBreak = rest.search(/\r?\n\r?\n|\r?\n(?=[A-ZА-ЯЎҚҒҲ‘’'])/);
  const raw = nextBreak > 0 ? rest.slice(0, nextBreak) : rest.slice(0, 800);
  return raw.replace(/^\s*[:.]\s*/, '').trim() || null;
}

function parseDocx(text: string, fallbackTitle: string): ParsedLesson {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Sarlavha
  let title: string | null = null;
  const mavzuLine = lines.find((l) =>
    /^(mavzu|amaliy mashg[‘'`']ulot mavzusi|ekskursiya mavzusi)\s*[:.]/i.test(l),
  );
  if (mavzuLine) {
    title = mavzuLine.replace(/^[^:]+[:.]/, '').trim();
  } else {
    const bigLine = lines.find((l) => /^[«"“]?[A-ZА-ЯЎҚҒҲ‘’'\s.,-]{15,}$/.test(l));
    if (bigLine) title = bigLine.replace(/[«»"“”]/g, '').trim();
  }
  if (!title) title = fallbackTitle;

  const fullText = text.replace(/\r/g, '');

  const objective = extractFieldValue(fullText, /Mashg[‘'`']ulotning\s+maqsadi/i);
  const equipment = extractFieldValue(fullText, /Kerakli\s+jihozlar/i);

  // Nazariy qism va undan keyingi qismni ajratish
  let theory: string | null = null;
  const theoryStart = fullText.search(/Nazariy\s+(qism|ma[‘'`']lumot)/i);
  if (theoryStart >= 0) {
    const afterHeader = fullText.slice(theoryStart);
    const firstNewline = afterHeader.indexOf('\n');
    const theoryBody = afterHeader.slice(firstNewline + 1);
    // Topshiriqlar boshlanishida to'xtaymiz
    const stopMatch = theoryBody.search(
      /(?:^|\n)\s*(?:\d+\s*-\s*(?:amaliy\s+)?topshiriq|vazifalar\s*[:.])/i,
    );
    theory = stopMatch > 0 ? theoryBody.slice(0, stopMatch).trim() : theoryBody.trim();
  }

  // Topshiriqlarni ajratish — "N-amaliy topshiriq." yoki "N-topshiriq." patterni
  const procedure: string[] = [];
  const taskRegex = /(?:^|\n)\s*(\d+)\s*-\s*(?:amaliy\s+)?topshiriq[.\s]([^\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(fullText)) !== null) {
    const taskTitle = match[2].trim().replace(/^[:.]\s*/, '');
    if (taskTitle.length > 3) procedure.push(taskTitle.slice(0, 400));
  }

  return {
    title: title.slice(0, 250),
    objective: objective ? objective.slice(0, 2000) : null,
    equipment: equipment ? equipment.slice(0, 2000) : null,
    theory: theory ? theory.slice(0, 50_000) : null,
    procedure,
  };
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  console.log('🌱 Ekologiya darslarini seed qilish…');
  console.log(`   Manba: ${MATERIALS_DIR}`);

  const availableFiles = new Set(fs.readdirSync(MATERIALS_DIR).filter((f) => f.endsWith('.docx')));

  // 1) Kurslarni upsert
  const courseIds = new Map<string, string>();
  for (const [slug, meta] of Object.entries(COURSES)) {
    const existing = await prisma.course.findUnique({ where: { slug } });
    if (existing) {
      await prisma.course.update({
        where: { slug },
        data: {
          nameUz: meta.nameUz,
          descriptionUz: meta.descriptionUz,
          educationLevel: EducationLevel.OLIY_TALIM,
        },
      });
      courseIds.set(slug, existing.id);
      console.log(`  ✓ Kurs mavjud: ${slug}`);
    } else {
      const created = await prisma.course.create({
        data: {
          id: uuidv7(),
          slug,
          nameUz: meta.nameUz,
          descriptionUz: meta.descriptionUz,
          educationLevel: EducationLevel.OLIY_TALIM,
          isPublished: true,
        },
      });
      courseIds.set(slug, created.id);
      console.log(`  ✓ Kurs yaratildi: ${slug}`);
    }
  }

  // 2) Darslarni upsert
  let added = 0;
  let updated = 0;
  for (const src of LESSONS) {
    if (!availableFiles.has(src.fileName)) {
      console.warn(`  ⚠ Fayl topilmadi: ${src.fileName}`);
      continue;
    }

    const filePath = path.join(MATERIALS_DIR, src.fileName);
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const parsed = parseDocx(result.value, src.fallbackTitle);

    const courseId = courseIds.get(src.courseSlug);
    if (!courseId) throw new Error(`Course ${src.courseSlug} not found`);

    const existing = await prisma.lesson.findFirst({
      where: { courseId, orderIndex: src.order },
    });

    const data = {
      courseId,
      orderIndex: src.order,
      lessonType: src.lessonType,
      titleUz: parsed.title ?? src.fallbackTitle,
      objectiveUz: parsed.objective,
      equipmentUz: parsed.equipment,
      theoryUz: parsed.theory,
      procedureUz: parsed.procedure,
    };

    if (existing) {
      await prisma.lesson.update({ where: { id: existing.id }, data });
      updated++;
      console.log(
        `  ↻ ${src.courseSlug}/#${src.order}: ${data.titleUz.slice(0, 60)} (${parsed.procedure.length} topshiriq)`,
      );
    } else {
      await prisma.lesson.create({ data: { ...data, id: uuidv7() } });
      added++;
      console.log(
        `  ✚ ${src.courseSlug}/#${src.order}: ${data.titleUz.slice(0, 60)} (${parsed.procedure.length} topshiriq)`,
      );
    }
  }

  console.log(`🌱 Ekologiya seed complete — ${added} yangi, ${updated} yangilangan.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
