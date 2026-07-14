/**
 * All mock data used by the Phase 0 dashboard.
 * When real endpoints are wired in Phase 3, this file goes away.
 */

export interface KpiPoint {
  key: 'ecoIndex' | 'airQuality' | 'waterQuality' | 'wasteRecycling' | 'greenAreas' | 'citizenActivity';
  value: number;
  unit?: string;
  status: 'good' | 'medium' | 'bad';
}

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

export const QUICK_FACTS = [
  { key: 'schools',    label: 'Maktablar soni',           value: '15 ta' },
  { key: 'kg',         label: "Bog'cha soni",              value: '1 ta' },
  { key: 'university', label: "Oliy ta'lim muassasasi",    value: '1 ta (ChDPU)' },
  { key: 'mahallas',   label: 'Mahallalar soni',           value: '2 ta' },
  { key: 'monitoring', label: 'Monitoring nuqtalari',      value: '24 ta' },
] as const;

export const MAP_LEGEND = [
  { icon: 'school',       label: '15 ta maktab',                             color: 'primary' as const },
  { icon: 'kindergarten', label: "1 ta bog'cha",                              color: 'warning' as const },
  { icon: 'university',   label: 'ChDPU',                                    color: 'purple' as const },
  { icon: 'mahalla',      label: 'Kimyogar mahallasi (Chirchiq shahri)',     color: 'primary' as const },
  { icon: 'mahalla',      label: "Abay mahallasi (Bektemir tumani)",         color: 'destructive' as const },
];

export interface EducationStat {
  key: 'courses' | 'activeStudents' | 'assignments' | 'certificates';
  value: string;
  captionKey: string;
  ctaKey: string;
  href: string;
  icon: 'courses' | 'students' | 'assignments' | 'certs';
  tone: 'primary' | 'blue' | 'warning' | 'success';
}

export const EDUCATION_STATS: EducationStat[] = [
  {
    key: 'courses',
    value: '12 kurs',
    captionKey: 'coursesCaption',
    ctaKey: 'coursesCta',
    href: '/learning',
    icon: 'courses',
    tone: 'primary',
  },
  {
    key: 'activeStudents',
    value: '1 245',
    captionKey: 'studentsCaption',
    ctaKey: 'studentsCta',
    href: '/users',
    icon: 'students',
    tone: 'success',
  },
  {
    key: 'assignments',
    value: '18',
    captionKey: 'assignmentsCaption',
    ctaKey: 'assignmentsCta',
    href: '/learning',
    icon: 'assignments',
    tone: 'blue',
  },
  {
    key: 'certificates',
    value: '532',
    captionKey: 'certsCaption',
    ctaKey: 'certsCta',
    href: '/learning',
    icon: 'certs',
    tone: 'warning',
  },
];

export interface NewsItem {
  id: string;
  title: string;
  date: string; // dd.MM.yyyy
  thumbnailHue: 'green' | 'blue';
}

export const NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Kimyogar mahallasida "Yashil makon" doirasida daraxt ekish aksiyasi o\'tkazildi.',
    date: '14.05.2025',
    thumbnailHue: 'green',
  },
  {
    id: '2',
    title: 'Maktablarda ekologik bilimlar viktorinasi boshlandi.',
    date: '12.05.2025',
    thumbnailHue: 'blue',
  },
];

export const QUICK_REPORTS = [
  { key: 'air',   label: 'Havo sifati hisoboti',      icon: 'air',    tone: 'blue' as const },
  { key: 'water', label: 'Suv sifati hisoboti',       icon: 'water',  tone: 'blue' as const },
  { key: 'waste', label: 'Chiqindi hisoboti',         icon: 'waste',  tone: 'success' as const },
  { key: 'green', label: 'Yashil hududlar hisoboti',  icon: 'tree',   tone: 'success' as const },
];
