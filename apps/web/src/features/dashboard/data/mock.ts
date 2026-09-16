/**
 * Bosh sahifa ma'lumotlari.
 * Ilova real DB'dan ba'zi ko'rsatkichlarni useAnalyticsOverview orqali oladi
 * (EducationCards); qolgan qismlar (KPI, xarita, yangiliklar) — sizning
 * `docs/materials/` papkangizdagi kontentga asoslangan sample ma'lumotlar.
 */

export interface KpiPoint {
  key: 'ecoIndex' | 'airQuality' | 'waterQuality' | 'wasteRecycling' | 'greenAreas' | 'citizenActivity';
  value: number;
  unit?: string;
  status: 'good' | 'medium' | 'bad';
}

// Chirchiq shahri uchun namunaviy ekologik indekslar (Phase 0 — real IoT
// sensorlari ulanmagan, bu qiymatlar dashboard prototipini ko'rsatish uchun).
export const KPIS: KpiPoint[] = [
  { key: 'ecoIndex', value: 78, unit: '/100', status: 'good' },
  { key: 'airQuality', value: 28, unit: 'µg/m³', status: 'good' },
  { key: 'waterQuality', value: 78, unit: '%', status: 'good' },
  { key: 'wasteRecycling', value: 65, unit: '%', status: 'medium' },
  { key: 'greenAreas', value: 32, unit: '%', status: 'medium' },
  { key: 'citizenActivity', value: 72, unit: '%', status: 'good' },
];

export const TREND_SERIES = [
  { month: 'Yan', airQuality: 68, waterQuality: 52, greenAreas: 34 },
  { month: 'Fev', airQuality: 74, waterQuality: 55, greenAreas: 46 },
  { month: 'Mar', airQuality: 71, waterQuality: 61, greenAreas: 39 },
  { month: 'Apr', airQuality: 82, waterQuality: 66, greenAreas: 41 },
  { month: 'May', airQuality: 85, waterQuality: 65, greenAreas: 42 },
];

// Loyihaning Chirchiq shahridagi hozirgi hududiy qamrovi.
export const QUICK_FACTS = [
  { key: 'schools',    label: 'Chirchiq 15-maktab',         value: '1 ta' },
  { key: 'kg',         label: "Bog'chalar",                 value: '1 ta' },
  { key: 'university', label: "Oliy ta'lim (ChDPU)",        value: '1 ta' },
  { key: 'mahallas',   label: 'Mahallalar',                 value: '2 ta' },
  { key: 'monitoring', label: 'Monitoring nuqtalari',       value: '24 ta' },
] as const;

export const MAP_LEGEND = [
  { icon: 'school',       label: 'Chirchiq 15-maktab',                       color: 'primary' as const },
  { icon: 'kindergarten', label: "1 ta bog'cha",                             color: 'warning' as const },
  { icon: 'university',   label: 'ChDPU (Chirchiq davlat pedagogika u.)',    color: 'purple' as const },
  { icon: 'mahalla',      label: 'Kimyogar mahallasi (Chirchiq shahri)',     color: 'primary' as const },
  { icon: 'mahalla',      label: 'Abay mahallasi (Bektemir tumani)',         color: 'destructive' as const },
];

export interface EducationStat {
  key: 'courses' | 'lessons' | 'materials' | 'levels';
  value: string;
  captionKey: string;
  ctaKey: string;
  href: string;
  icon: 'courses' | 'lessons' | 'materials' | 'levels';
  tone: 'primary' | 'blue' | 'warning' | 'success';
}

// Ta'lim jarayoni bo'limi — E-learning platformasining hozirgi holati.
// Sonlar `docs/materials/` papkasidan yuklab qo'yilgan kontentga muvofiq.
export const EDUCATION_STATS: EducationStat[] = [
  {
    key: 'levels',
    value: '3 daraja',
    captionKey: 'levelsCaption',
    ctaKey: 'levelsCta',
    href: '/learning',
    icon: 'levels',
    tone: 'primary',
  },
  {
    key: 'courses',
    value: '4 kurs',
    captionKey: 'coursesCaption',
    ctaKey: 'coursesCta',
    href: '/learning',
    icon: 'courses',
    tone: 'success',
  },
  {
    key: 'lessons',
    value: '57 dars',
    captionKey: 'lessonsCaption',
    ctaKey: 'lessonsCta',
    href: '/learning',
    icon: 'lessons',
    tone: 'blue',
  },
  {
    key: 'materials',
    value: '48 fayl',
    captionKey: 'materialsCaption',
    ctaKey: 'materialsCta',
    href: '/learning',
    icon: 'materials',
    tone: 'warning',
  },
];

export interface NewsItem {
  id: string;
  title: string;
  date: string; // dd.MM.yyyy
  thumbnailHue: 'green' | 'blue';
}

// Platformaga yuklab qo'yilgan real kontent haqidagi yangiliklar.
export const NEWS: NewsItem[] = [
  {
    id: '1',
    title:
      "Maktabgacha ta'lim bo'limiga 10 ta yangi ekologik dars qo'shildi: tabiat, suv, chiqindi, hayvonlar va boshqa mavzular.",
    date: '15.09.2026',
    thumbnailHue: 'green',
  },
  {
    id: '2',
    title:
      "Maktab bo'limi 6–7 sinf o'quvchilari uchun 10 ta ma'ruzali kurs bilan boyitildi (havo, iqlim, energiya, chiqindilar).",
    date: '15.09.2026',
    thumbnailHue: 'blue',
  },
  {
    id: '3',
    title:
      "Oliy ta'lim bo'limi ChDPU talabalari uchun 15 mavzuli amaliy-laboratoriya kursi bilan ochildi: biosfera, Orol muammosi, ekologik pasport.",
    date: '15.09.2026',
    thumbnailHue: 'green',
  },
  {
    id: '4',
    title:
      "Oliy ta'lim bo'limiga «Pedagogik dasturiy vositalar» kursi qo'shildi: 15 ma'ruza va 7 amaliy mashg'ulot — virtual laboratoriya, LMS Moodle, iSpring, MOOC va boshqalar.",
    date: '16.09.2026',
    thumbnailHue: 'blue',
  },
];

export const QUICK_REPORTS = [
  { key: 'air',   label: 'Havo sifati hisoboti',      icon: 'air',    tone: 'blue' as const },
  { key: 'water', label: 'Suv sifati hisoboti',       icon: 'water',  tone: 'blue' as const },
  { key: 'waste', label: 'Chiqindi hisoboti',         icon: 'waste',  tone: 'success' as const },
  { key: 'green', label: 'Yashil hududlar hisoboti',  icon: 'tree',   tone: 'success' as const },
];
