import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMessageRole, Prisma } from '@prisma/client';
import type {
  AiConversationDetailDto,
  AiConversationSummaryDto,
  AiMessageDto,
  ConversationQuery,
  SendMessageResponse,
} from '@eco/shared';
import { v7 as uuidv7 } from 'uuid';

import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, type AiProvider } from './providers/ai-provider.interface';

/**
 * Chatbot — token-tejamkor RAG (Retrieval-Augmented Generation).
 *
 * Ish oqimi (har xabar uchun):
 *   1. Foydalanuvchi savolidagi kalit so'zlarni ajratib olamiz.
 *   2. Kurslar/darslar/materiallardan eng mos parchalarni topib olamiz.
 *   3. Agar bironta ham parcha topilmasa — AI'ga umuman chaqirmasdan
 *      "off-topic" javobi qaytaramiz (0 token sarfi).
 *   4. Aks holda: kichik strict prompt + top 3 ta parcha (jami ~1500 belgi)
 *      AI'ga yuboriladi. Bu 25 000 belgili avvalgi KB'ga qaraganda
 *      ~15× kam token sarflaydi.
 */

const OFF_TOPIC_REPLY = "Kechirasiz, bu savol Eco-Balance platformasidagi ekologiya kurslariga aloqador emas. Iltimos, ekologiya, tabiat yoki kurs mavzulari bo'yicha savol bering.";

const STRICT_SYSTEM_PROMPT = `Sen Eco-Balance platformasining AI yordamchisiisan.

QOIDALAR:
1. Ekologiya, tabiat, kurs materiallari bo'yicha savollarga to'liq javob ber.
2. Oddiy odobli suhbatga (salom, rahmat, xayr) qisqa iliq javob qaytar va ekologiya haqida savol berishga taklif et.
3. Agar KONTEKST bo'lsa — undan foydalanib javob ber, oxirida manba dars nomini "([dars nomi])" ko'rinishida ko'rsat.
4. Kontekstsiz umumiy ekologiya savollariga o'z bilimingdan javob berishing mumkin — lekin qisqa (2-3 jumla).
5. Ekologiyaga umuman aloqasi yo'q savollarga (siyosat, valyuta, sport, film, hazil, matematik hisob, ob-havo, boshqa fanlar) javob berma — "Kechirasiz, bu savol ekologiya kurslarimga aloqador emas" deb qaytar.
6. Har doim O'zbek tilida, do'stona va qisqa yoz.`;

// Iliq salom-alik javoblari — AI'ni chaqirmasdan tezda javob beramiz.
// Kalitlar lowercase va so'z chegarasi bilan tekshiriladi.
const GREETING_PATTERNS: RegExp[] = [
  /\b(salom|salomlar|assalom|assalomu\s*alaykum|hi|hello|hey|hayr|xayr|hayrli\s*kun|hayrli\s*ertalab)\b/i,
];

const GREETING_REPLIES: string[] = [
  "Salom! Men Eco-Balance AI yordamchisiman. Sizga ekologiya, tabiat va platformadagi kurslar bo'yicha yordam berishga tayyorman. Qanday savolingiz bor?",
  "Assalomu alaykum! Sizga qanday yordam berishim mumkin? Ekologiya kurslari, darslar yoki tabiat mavzusida savollaringizni bering.",
  "Salom! Bugun ekologiya haqida nima o'rganmoqchisiz? Kurs materiallari bo'yicha savolingizni yuboring, birga o'ylab ko'ramiz.",
];

// Minnatdorchilik/xayrlashuv javoblari
const GRATITUDE_PATTERNS: RegExp[] = [
  /\b(rahmat|tashakkur|thanks|thx)\b/i,
];
const GRATITUDE_REPLY = "Arzimaydi! Yana savol bo'lsa yozing, men shu yerdaman. 🌿";

const FAREWELL_PATTERNS: RegExp[] = [
  /\b(xayr|hayr|bye|good\s*bye|hozircha|salomat\s*bo)/i,
];
const FAREWELL_REPLY = "Yaxshi qoling! Ekologiya haqida yana savol bo'lsa qaytib keling. Tabiatni asrash — kelajakni asrash demakdir. 🌱";

// Aniq off-topic mavzular — AI'ga umuman chaqirmasdan rad qilamiz.
const HARD_OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(valyuta|kurs\s*(dollar|som|rubl|evro)|narx(i|lar)?\s*(dollar|som|rubl|kripto))\b/i,
  /\b(futbol|kino|film|serial|musiqa|qo['`ʻ]shiq|sport|tennis|voleybol|basketbol)\b/i,
  /\b(prezident|saylov|siyosat|urush|hukumat|parlament|partiya|raketa|snaryad|drun)\b/i,
  /\b(porno|erotik|ochiq\s*rasm|katta\s*yosh)\b/i,
  /\b(hazil|anekdot|latifa|masxaraboz)\b/i,
];

// Uzbek stop-words — kontekstni topish uchun kalit so'zlardan chiqarib tashlaymiz.
const STOP_WORDS = new Set([
  'nima', 'kim', 'qanday', 'qaerda', 'qachon', 'nechta', 'necha', 'qancha',
  'qanaqa', 'nechanchi', 'nechada',
  'bor', 'yoq', 'yoqmi', 'boshqa', 'hamma', 'hech', 'kop', 'kam',
  'shu', 'bu', 'shundoq', 'shunday', 'ushbu', 'uni', 'unga', 'undan',
  'meni', 'mening', 'menga', 'sen', 'sen?', 'siz', 'sizning', 'sizga',
  'bilan', 'ham', 'uchun', 'lekin', 'yoki', 'agar', 'chunki', 'toki',
  'salom', 'assalom', 'assalomu', 'aleykum', 'rahmat', 'kechir', 'xayr', 'hayr',
  'bugun', 'bugungi', 'ertaga', 'kecha', 'kechqurun', 'ertalab',
  'ayta', 'ayting', 'aytib', 'aytadi', 'ayt', 'gapir', 'gapirib',
  'kerak', 'kerakli', 'zarur', 'muhim',
  'foydali', 'foyda', 'zarar',
  'yaxshi', 'yomon', 'katta', 'kichik',
  'menda', 'mendan', 'seni', 'sening', 'sizni',
  'bolgan', 'bolmagan', 'ekan',
]);

interface KbChunk {
  source: string; // masalan "Ekologiya asoslari > 3-dars: Suvni tejaymiz"
  text: string;
  score: number;
}

const MAX_CHUNKS = 3;
const MAX_CHUNK_CHARS = 900; // ~250 token
const MAX_KEYWORD_MATCHES_TO_TRIGGER = 1; // eng kamida 1 ta kalit so'z topilishi kerak

const CONVERSATION_SUMMARY_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { messages: true } },
} satisfies Prisma.AiConversationSelect;

type ConversationSummaryRow = Prisma.AiConversationGetPayload<{
  select: typeof CONVERSATION_SUMMARY_SELECT;
}>;

type MessageRow = Prisma.AiMessageGetPayload<{
  select: {
    id: true;
    conversationId: true;
    role: true;
    content: true;
    createdAt: true;
  };
}>;

function toSummaryDto(row: ConversationSummaryRow): AiConversationSummaryDto {
  return {
    id: row.id,
    title: row.title,
    messageCount: row._count.messages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageDto(row: MessageRow): AiMessageDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Trim a raw prompt to a nice sidebar-friendly title (max ~50 chars, single line). */
function deriveTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 50) return collapsed || 'Yangi suhbat';
  return `${collapsed.slice(0, 50).trimEnd()}…`;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly settings: PlatformSettingsService,
  ) {}

  /**
   * KB "corpus" — barcha kurs/dars/material matnlari flat massiv holida.
   * In-memory cache 5 daqiqa. Yangi kontent qo'shilganda invalidateKb() chaqiring.
   */
  private corpusCache: { chunks: Array<{ source: string; text: string; lowered: string }>; cachedAt: number } | null = null;

  private async buildCorpus() {
    const now = Date.now();
    if (this.corpusCache && now - this.corpusCache.cachedAt < 5 * 60 * 1000) {
      return this.corpusCache.chunks;
    }

    const courses = await this.prisma.course.findMany({
      where: { isPublished: true },
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
          select: {
            orderIndex: true,
            titleUz: true,
            objectiveUz: true,
            equipmentUz: true,
            theoryUz: true,
            procedureUz: true,
          },
        },
        materials: {
          where: { contentText: { not: null } },
          select: { fileName: true, contentText: true, lessonId: true },
        },
      },
    });

    const chunks: Array<{ source: string; text: string; lowered: string }> = [];
    for (const c of courses) {
      // Kurs xulosasi — bitta parcha
      if (c.descriptionUz) {
        const t = `${c.nameUz}: ${c.descriptionUz}`;
        chunks.push({ source: `Kurs "${c.nameUz}"`, text: t, lowered: t.toLowerCase() });
      }
      // Har dars — bitta parcha (theoryUz + procedureUz birlashtirilgan)
      for (const l of c.lessons) {
        const parts: string[] = [];
        if (l.objectiveUz) parts.push(`Maqsad: ${l.objectiveUz}`);
        if (l.theoryUz) parts.push(l.theoryUz);
        const procedure = (l.procedureUz as unknown as string[]) ?? [];
        if (Array.isArray(procedure) && procedure.length > 0) {
          parts.push(`Topshiriqlar: ${procedure.join('; ')}`);
        }
        const text = `${l.titleUz}. ${parts.join(' ')}`;
        chunks.push({
          source: `${c.nameUz} > ${l.orderIndex}-dars: ${l.titleUz}`,
          text,
          lowered: text.toLowerCase(),
        });
      }
      // Materiallar — matni bor bo'lsa har biri parcha
      for (const m of c.materials) {
        if (!m.contentText) continue;
        chunks.push({
          source: `${c.nameUz} > fayl: ${m.fileName}`,
          text: m.contentText,
          lowered: m.contentText.toLowerCase(),
        });
      }
    }

    this.corpusCache = { chunks, cachedAt: now };
    return chunks;
  }

  invalidateKb(): void {
    this.corpusCache = null;
  }

  /**
   * Savolni tez ajratib olish — 0 tokenlik canned javoblar uchun.
   * Qaytaradi: javob matni (canned) yoki null (AI'ga yuborish kerak).
   */
  private detectCannedReply(query: string): string | null {
    const short = query.length <= 60;

    // Aniq off-topic mavzular (uzun bo'lsa ham rad qilamiz)
    for (const re of HARD_OFF_TOPIC_PATTERNS) {
      if (re.test(query)) return OFF_TOPIC_REPLY;
    }

    // Qisqa xabar bo'lsa — salom-alik/rahmat/xayrlashuv shablonlarini tekshiramiz.
    if (short) {
      for (const re of FAREWELL_PATTERNS) {
        if (re.test(query)) return FAREWELL_REPLY;
      }
      for (const re of GRATITUDE_PATTERNS) {
        if (re.test(query)) return GRATITUDE_REPLY;
      }
      for (const re of GREETING_PATTERNS) {
        if (re.test(query)) {
          // Random qilib turli xil salom qaytaramiz — tabiiy his qildiradi.
          // Determinizm uchun: query.length bo'yicha tanlash.
          return GREETING_REPLIES[query.length % GREETING_REPLIES.length]!;
        }
      }
    }
    return null;
  }

  /** Foydalanuvchi savolidan kalit so'zlarni ajratish. */
  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[?.,!;:"'()\[\]{}]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  }

  /** Corpus'dan top N parchani topib qaytaradi. Score = so'zlarga mos kelish soni. */
  private async findRelevantChunks(query: string): Promise<KbChunk[]> {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return [];

    const corpus = await this.buildCorpus();
    const scored: KbChunk[] = [];
    const keywordRegexes = keywords.map((k) => ({
      re: new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      kw: k,
    }));
    for (const c of corpus) {
      let occurrences = 0;
      const uniqueMatched = new Set<string>();
      for (const { re, kw } of keywordRegexes) {
        const matches = c.lowered.match(re);
        if (matches) {
          occurrences += matches.length;
          uniqueMatched.add(kw);
        }
      }
      // Off-topic'ni oldini olish uchun: bitta kalit so'z mos kelsa yetmaydi —
      // kamida 2 ta UNIKAL kalit so'z bo'lishi kerak, YOKI bitta so'z 3+ marta
      // takrorlansa (mavzuga ko'p bog'liq degani).
      const strong = uniqueMatched.size >= 2 || occurrences >= 3;
      if (strong) {
        scored.push({
          source: c.source,
          text: c.text.slice(0, MAX_CHUNK_CHARS),
          score: occurrences,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_CHUNKS).filter((c) => c.score >= MAX_KEYWORD_MATCHES_TO_TRIGGER);
  }

  async listConversations(
    userId: string,
    query: ConversationQuery,
  ): Promise<{ data: AiConversationSummaryDto[]; meta: { page: number; perPage: number; total: number; totalPages: number } }> {
    const { page, perPage, search } = query;

    const where: Prisma.AiConversationWhereInput = {
      userId,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.aiConversation.count({ where }),
      this.prisma.aiConversation.findMany({
        where,
        select: CONVERSATION_SUMMARY_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map(toSummaryDto),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async createConversation(userId: string, title?: string): Promise<AiConversationSummaryDto> {
    const row = await this.prisma.aiConversation.create({
      data: {
        id: uuidv7(),
        userId,
        title: title?.trim() || 'Yangi suhbat',
      },
      select: CONVERSATION_SUMMARY_SELECT,
    });
    return toSummaryDto(row);
  }

  async getConversation(userId: string, id: string): Promise<AiConversationDetailDto> {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id },
      select: CONVERSATION_SUMMARY_SELECT,
    });
    if (!conversation) throw new NotFoundException('Suhbat topilmadi');

    const owner = await this.prisma.aiConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (owner?.userId !== userId) throw new NotFoundException('Suhbat topilmadi');

    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return {
      ...toSummaryDto(conversation),
      messages: messages.map(toMessageDto),
    };
  }

  async removeConversation(userId: string, id: string): Promise<void> {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!conversation) throw new NotFoundException('Suhbat topilmadi');
    if (conversation.userId !== userId) {
      // Same shape as "not found" externally so users can't probe for others' IDs.
      throw new ForbiddenException('Bu suhbatni o‘chirishga ruxsat yo‘q');
    }

    await this.prisma.aiConversation.delete({ where: { id } });
  }

  async sendMessage(
    userId: string,
    conversationId: string | null,
    content: string,
  ): Promise<SendMessageResponse> {
    const trimmedContent = content.trim();

    // 1. Oldindan aniqlangan javob turlari — AI'ga chaqirmaymiz (0 token).
    //    Bular: iliq salomlashuv, rahmat, xayrlashuv, aniq off-topic mavzular.
    const cannedReply = this.detectCannedReply(trimmedContent);

    // 2. Kontekst qidirish — savol kurs materiallariga qanchalik yaqinligi.
    const relevantChunks = cannedReply
      ? []
      : await this.findRelevantChunks(trimmedContent);

    // 3. Sistemli prompt: yumshoq — AI oddiy savollarga o'z bilimidan javob
    //    berishi mumkin (ekologiya bilan bog'liq), lekin siyosat/valyuta/sportga
    //    umuman aralashmasin. Kontekst bo'lsa qo'shamiz.
    const customPrompt = await this.settings.getWithEnvFallback(
      'AI_SYSTEM_PROMPT',
      'AI_SYSTEM_PROMPT',
    );
    const contextBlock =
      relevantChunks.length > 0
        ? '\n\nKONTEKST (kurs materiallaridan):\n' +
          relevantChunks
            .map((c, i) => `[${i + 1}] Manba: ${c.source}\n${c.text}`)
            .join('\n\n')
        : '';
    const systemPrompt =
      (customPrompt?.trim() || STRICT_SYSTEM_PROMPT) + contextBlock;

    let conversation = conversationId
      ? await this.prisma.aiConversation.findUnique({
          where: { id: conversationId },
          select: { id: true, userId: true },
        })
      : null;

    if (conversationId && !conversation) throw new NotFoundException('Suhbat topilmadi');
    if (conversation && conversation.userId !== userId) {
      throw new ForbiddenException('Bu suhbatga xabar yozishga ruxsat yo‘q');
    }

    if (!conversation) {
      const created = await this.prisma.aiConversation.create({
        data: {
          id: uuidv7(),
          userId,
          title: deriveTitle(trimmedContent),
        },
        select: { id: true, userId: true },
      });
      conversation = created;
    }

    const userMessage = await this.prisma.aiMessage.create({
      data: {
        id: uuidv7(),
        conversationId: conversation.id,
        role: AiMessageRole.USER,
        content: trimmedContent,
      },
    });

    const priorMessages = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    let aiText: string;
    let aiTokens: number;

    if (cannedReply) {
      // 0 token — canned javob (salom/rahmat/off-topic).
      aiText = cannedReply;
      aiTokens = 0;
    } else {
      const aiResult = await this.ai.sendMessage({
        history: priorMessages.map((m) => ({
          role: m.role === AiMessageRole.USER ? 'user' : 'assistant',
          content: m.content,
        })),
        system: systemPrompt,
      });
      aiText = aiResult.text;
      aiTokens = aiResult.tokens;
    }

    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        id: uuidv7(),
        conversationId: conversation.id,
        role: AiMessageRole.ASSISTANT,
        content: aiText,
        tokens: aiTokens,
      },
    });

    // Bump the conversation's updatedAt so it floats to the top of the list.
    const updated = await this.prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
      select: CONVERSATION_SUMMARY_SELECT,
    });

    return {
      conversation: toSummaryDto(updated),
      userMessage: toMessageDto(userMessage),
      assistantMessage: toMessageDto(assistantMessage),
    };
  }
}
