/**
 * Tayyor javoblar (salom/rahmat/xayr va aniq mavzudan tashqari savollar) —
 * AI chaqirilmaydi, 0 token. Kalit sozlanmagan bo'lsa ham ishlaydi.
 */

export const DEFAULT_SYSTEM_PROMPT = `Sen PedResearch Lab platformasining AI yordamchisisan.

QOIDALAR:
1. Ekologiya, tabiat, kurs materiallari bo'yicha savollarga to'liq javob ber.
2. Oddiy odobli suhbatga (salom, rahmat, xayr) qisqa iliq javob qaytar va ekologiya haqida savol berishga taklif et.
3. Agar KONTEKST bo'lsa — undan foydalanib javob ber, oxirida manba dars nomini "([dars nomi])" ko'rinishida ko'rsat.
4. Kontekstsiz umumiy ekologiya savollariga o'z bilimingdan javob berishing mumkin — lekin qisqa (2-3 jumla).
5. Ekologiyaga umuman aloqasi yo'q savollarga (siyosat, valyuta, sport, film, hazil, matematik hisob, ob-havo, boshqa fanlar) javob berma — "Kechirasiz, bu savol ekologiya kurslarimga aloqador emas" deb qaytar.
6. Har doim O'zbek tilida, do'stona va qisqa yoz.`;

const OFF_TOPIC_REPLY =
  "Kechirasiz, bu savol PedResearch Lab platformasidagi ekologiya kurslariga aloqador emas. Iltimos, ekologiya, tabiat yoki kurs mavzulari bo'yicha savol bering.";

const GREETING_REPLIES = [
  "Salom! Men PedResearch Lab AI yordamchisiman. Sizga ekologiya, tabiat va platformadagi kurslar bo'yicha yordam berishga tayyorman. Qanday savolingiz bor?",
  'Assalomu alaykum! Sizga qanday yordam berishim mumkin? Ekologiya kurslari, darslar yoki tabiat mavzusida savollaringizni bering.',
  "Salom! Bugun ekologiya haqida nima o'rganmoqchisiz? Kurs materiallari bo'yicha savolingizni yuboring, birga o'ylab ko'ramiz.",
];
const GRATITUDE_REPLY = "Arzimaydi! Yana savol bo'lsa yozing, men shu yerdaman. 🌿";
const FAREWELL_REPLY =
  "Yaxshi qoling! Ekologiya haqida yana savol bo'lsa qaytib keling. Tabiatni asrash — kelajakni asrash demakdir. 🌱";

const GREETING = /\b(salom|salomlar|assalom|assalomu\s*alaykum|hi|hello|hey|hayrli\s*kun|hayrli\s*ertalab)\b/i;
const GRATITUDE = /\b(rahmat|tashakkur|thanks|thx)\b/i;
const FAREWELL = /\b(xayr|hayr|bye|good\s*bye|hozircha|salomat\s*bo)/i;

const HARD_OFF_TOPIC = [
  /\b(valyuta|kurs\s*(dollar|som|rubl|evro)|narx(i|lar)?\s*(dollar|som|rubl|kripto))\b/i,
  /\b(futbol|kino|film|serial|musiqa|qo['`ʻ‘]shiq|sport|tennis|voleybol|basketbol)\b/i,
  /\b(prezident|saylov|siyosat|urush|hukumat|parlament|partiya|raketa|snaryad|drun)\b/i,
  /\b(porno|erotik|ochiq\s*rasm|katta\s*yosh)\b/i,
  /\b(hazil|anekdot|latifa|masxaraboz)\b/i,
];

/** Tayyor javob yoki null (AI'ga yuborish kerak). */
export function cannedReply(query: string): string | null {
  if (HARD_OFF_TOPIC.some((re) => re.test(query))) return OFF_TOPIC_REPLY;
  // Uzun xabar ichidagi "salom" — haqiqiy savolning bir qismi bo'lishi mumkin.
  if (query.length > 60) return null;
  if (FAREWELL.test(query)) return FAREWELL_REPLY;
  if (GRATITUDE.test(query)) return GRATITUDE_REPLY;
  if (GREETING.test(query)) return GREETING_REPLIES[query.length % GREETING_REPLIES.length]!;
  return null;
}

export interface KnowledgeChunk {
  source: string;
  text: string;
}

export function buildSystemPrompt(custom: string | null, chunks: KnowledgeChunk[]): string {
  const base = custom ?? DEFAULT_SYSTEM_PROMPT;
  if (chunks.length === 0) return base;
  const context = chunks.map((c, i) => `[${i + 1}] Manba: ${c.source}\n${c.text}`).join('\n\n');
  return `${base}\n\nKONTEKST (kurs materiallaridan):\n${context}`;
}

/** Sidebar uchun qisqa sarlavha (bir qator, ~50 belgi). */
export function deriveTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 50) return collapsed || 'Yangi suhbat';
  return `${collapsed.slice(0, 50).trimEnd()}…`;
}
