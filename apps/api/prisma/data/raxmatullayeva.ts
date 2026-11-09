/**
 * "Platforma Raxmatullayeva A" to'plami (2026-11-09):
 * - 8 ta gologramma video ssenariysi → video darsligi bor darslarga;
 * - amaliy mashg'ulotlarning talaba varag'i versiyasi (jadvallardagi javoblarsiz) →
 *   ekologiya darslaridagi eski nusxa o'rniga (fayl nomlari o'sha, `replace`);
 * - 10 ta interaktiv topshiriq (docx + o'zi ishlaydigan html) → mavzusi mos darsga;
 * - ChatGPT sahifalaridan faqat topshiriqlar matni ajratilgan 2 ta to'plam → kurs sathiga.
 */
import type { PrismaClient } from '@prisma/client';

import { attachLessonFiles, DOCX_MIME, HTML_MIME, type LessonFile } from './ekologiya-fayllar';

const EA = 'ekologiya-asoslari';
const OT = 'ozbekiston-tabiati-va-siyosati';

const docx = (courseSlug: string, orderIndex: number | null, path: string): LessonFile => ({
  courseSlug, orderIndex, path, mimeType: DOCX_MIME,
});

const GOLOGRAMMA: LessonFile[] = ([
  [EA, 5, 'Qishloq_xojaligi_va_biosfera'],
  [EA, 6, 'Suv_muhitiga_moslashish'],
  [EA, 7, 'Tuproq_muhitiga_moslashish'],
  [EA, 8, 'Shaharlarda_shovqin'],
  [EA, 9, 'Biosfera_chegaralari'],
  [OT, 1, 'Orol_boyi_muammolari'],
  [OT, 3, 'Hayvonot_olamini_muhofaza_qilish'],
  [OT, 4, 'Osimlik_qoplamini_muhofaza_qilish'],
] as const).map(([c, i, name]) => docx(c, i, `raxmatullayeva/gologramma/Gologramma_ssenariysi_${name}.docx`));

/** 1-mashg'ulot o'zgarmagan — faqat 2–15. */
const AMALIY_YANGI: LessonFile[] = [
  ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => docx(EA, n, `ekologiya/Ekologiya_asoslari_${n}-mashgulot.docx`)),
  ...[1, 2, 3, 4, 5, 6].map((n) => docx(OT, n, `ekologiya/Ozbekiston_tabiati_${n}-mashgulot.docx`)),
];

const INTERAKTIV: LessonFile[] = ([
  [1, 'Kampus_ekologik_holati', EA, 2],
  [2, 'Suv_sarfini_tahlil_qilish', OT, 1],
  [3, 'Chiqindilarni_saralash', OT, 5],
  [4, 'Havo_sifatini_kuzatish', EA, 8],
  [5, 'Bir_talaba_bir_daraxt', OT, 4],
  [6, 'Energiya_tejamkor_auditoriya', EA, 3],
  [7, 'Ichimlik_suvi_sifati', EA, 6],
  [8, 'Plastik_istemolini_kamaytirish', OT, 5],
  [9, 'Eko-xarita_tuzish', EA, 4],
  [10, 'Yotoqxona_ekologik_muhiti', EA, 3],
] as const).flatMap(([n, name, c, i]) => [
  docx(c, i, `raxmatullayeva/interaktiv/Interaktiv_${n}_${name}.docx`),
  { courseSlug: c, orderIndex: i, path: `raxmatullayeva/interaktiv/Interaktiv_${n}_${name}.html`, mimeType: HTML_MIME },
]);

const TOPSHIRIQLAR: LessonFile[] = [
  docx(EA, null, 'raxmatullayeva/topshiriqlar/Mantiqiy_fikrlash_topshiriqlari.docx'),
  docx(EA, null, 'raxmatullayeva/topshiriqlar/Kreativ_moslashtirish_topshiriqlari.docx'),
];

export async function importRaxmatullayeva(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  const g = await attachLessonFiles(prisma, GOLOGRAMMA);
  const a = await attachLessonFiles(prisma, AMALIY_YANGI, true);
  const i = await attachLessonFiles(prisma, INTERAKTIV);
  const t = await attachLessonFiles(prisma, TOPSHIRIQLAR);
  log(`✓ Raxmatullayeva materiallari: ${g} gologramma ssenariysi, ${a} amaliy mashg'ulot yangilandi, ${i} interaktiv fayl, ${t} topshiriqlar to'plami`);
  return true;
}
