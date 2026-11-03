import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.service';
import { HIGHER_EDUCATION } from '../courses/course-access.service';
import type { KnowledgeChunk } from './assistant-replies';

interface CorpusChunk extends KnowledgeChunk {
  normalized: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const CHUNK_CHARS = 900;
const MAX_CHUNKS_PER_DOC = 300;
const TOP_K = 3;
const MAX_KEYWORDS = 12;

const STOP_WORDS = new Set([
  'nima', 'kim', 'qanday', 'qaerda', 'qayerda', 'qachon', 'nechta', 'necha', 'qancha', 'qanaqa', 'nechanchi',
  'nechada', 'bor', 'yoq', 'yoqmi', 'boshqa', 'hamma', 'hech', 'kop', 'kam', 'shu', 'bu', 'shundoq',
  'shunday', 'ushbu', 'uni', 'unga', 'undan', 'meni', 'mening', 'menga', 'sen', 'siz', 'sizning', 'sizga',
  'bilan', 'ham', 'uchun', 'lekin', 'yoki', 'agar', 'chunki', 'toki', 'salom', 'assalom', 'assalomu',
  'aleykum', 'rahmat', 'kechir', 'xayr', 'hayr', 'bugun', 'bugungi', 'ertaga', 'kecha', 'kechqurun',
  'ertalab', 'ayta', 'ayting', 'aytib', 'aytadi', 'ayt', 'gapir', 'gapirib', 'kerak', 'kerakli', 'zarur',
  'muhim', 'foydali', 'foyda', 'zarar', 'yaxshi', 'yomon', 'katta', 'kichik', 'menda', 'mendan', 'seni',
  'sening', 'sizni', 'bolgan', 'bolmagan', 'ekan',
]);

/** Kichik harf + o‘/g‘ apostrof variantlarini bitta belgiga keltirish. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’ʻʼ`']/g, 'ʻ');
}

/** Matnni ~CHUNK_CHARS bo'laklarga, iloji bo'lsa gap chegarasida. */
function split(text: string): string[] {
  const out: string[] = [];
  let rest = text.replace(/\s+/g, ' ').trim();
  while (rest && out.length < MAX_CHUNKS_PER_DOC) {
    if (rest.length <= CHUNK_CHARS) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf('. ', CHUNK_CHARS);
    if (cut < CHUNK_CHARS / 2) cut = rest.lastIndexOf(' ', CHUNK_CHARS);
    if (cut <= 0) cut = CHUNK_CHARS;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Token-tejamkor RAG: nashr qilingan kurslar, darslar va materiallar matni
 * (`course_materials.content_text`) bo'laklarga bo'linib xotirada keshlanadi;
 * savolning kalit so'zlariga eng mos 3 bo'lak AI kontekstiga qo'shiladi.
 */
@Injectable()
export class KnowledgeService {
  private cache: { chunks: CorpusChunk[]; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invalidate() {
    this.cache = null;
  }

  async search(query: string): Promise<KnowledgeChunk[]> {
    const keywords = [
      ...new Set(
        normalize(query)
          .replace(/[?.,!;:"()[\]{}«»]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.replace(/ʻ/g, ''))),
      ),
    ].slice(0, MAX_KEYWORDS);
    if (keywords.length === 0) return [];

    // So'z boshidan moslik: o'zbekcha qo'shimchalar (suv → suvni, suvlar) ham topiladi.
    const patterns = keywords.map((k) => new RegExp(`(?<![\\p{L}\\p{N}ʻ])${escapeRe(k)}`, 'gu'));
    const scored: Array<KnowledgeChunk & { score: number }> = [];
    for (const chunk of await this.corpus()) {
      let hits = 0;
      let unique = 0;
      for (const re of patterns) {
        const n = chunk.normalized.match(re)?.length ?? 0;
        hits += n;
        if (n > 0) unique += 1;
      }
      // Tasodifiy bitta so'z mosligi yetmaydi: 2+ turli so'z yoki bitta so'z 3+ marta.
      if (unique >= 2 || hits >= 3) scored.push({ source: chunk.source, text: chunk.text, score: hits });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K)
      .map(({ source, text }) => ({ source, text }));
  }

  private async corpus(): Promise<CorpusChunk[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.chunks;

    const courses = await this.prisma.course.findMany({
      where: { isPublished: true, educationLevel: HIGHER_EDUCATION },
      select: {
        nameUz: true,
        descriptionUz: true,
        lessons: {
          where: { archivedAt: null, isPublished: true },
          orderBy: { orderIndex: 'asc' },
          select: { orderIndex: true, titleUz: true, objectiveUz: true, theoryUz: true, procedureUz: true },
        },
        materials: { where: { contentText: { not: null } }, select: { fileName: true, contentText: true } },
      },
    });

    const chunks: CorpusChunk[] = [];
    const add = (source: string, text: string) => {
      for (const part of split(text)) chunks.push({ source, text: part, normalized: normalize(part) });
    };
    for (const c of courses) {
      if (c.descriptionUz) add(`Kurs "${c.nameUz}"`, `${c.nameUz}: ${c.descriptionUz}`);
      for (const l of c.lessons) {
        const procedure = Array.isArray(l.procedureUz) ? l.procedureUz.filter((p) => typeof p === 'string') : [];
        const parts = [
          l.objectiveUz ? `Maqsad: ${l.objectiveUz}` : '',
          l.theoryUz ?? '',
          procedure.length ? `Topshiriqlar: ${procedure.join('; ')}` : '',
        ].filter(Boolean);
        add(`${c.nameUz} > ${l.orderIndex}-dars: ${l.titleUz}`, `${l.titleUz}. ${parts.join(' ')}`);
      }
      for (const m of c.materials) add(`${c.nameUz} > fayl: ${m.fileName}`, m.contentText!);
    }

    this.cache = { chunks, at: Date.now() };
    return chunks;
  }
}
