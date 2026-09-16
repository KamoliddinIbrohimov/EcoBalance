// apps/web/src/features/recommendations/data/tips.ts
// Manba: docs/materials/{mahalla,maktab,bogcha}/... va oliy ta'lim materiallari.
// Bu maslahatlar hujjatlardan so'zma-so'z olingan — o'ylab topilmagan.

export type EcoTipCategory =
  | 'water'
  | 'energy'
  | 'waste'
  | 'air'
  | 'green'
  | 'animals'
  | 'climate';

export interface EcoTip {
  category: EcoTipCategory;
  textUz: string;
}

export const CATEGORY_LABELS_UZ: Record<EcoTipCategory, string> = {
  water: 'Suv',
  energy: 'Energiya',
  waste: 'Chiqindi',
  air: 'Havo',
  green: 'Yashil hudud',
  animals: 'Hayvonlar',
  climate: 'Iqlim',
};

export const ECO_TIPS: EcoTip[] = [
  // Suv
  { category: 'water', textUz: 'Tish yuvayotganda kranni ochiq qoldirmang — yoping.' },
  {
    category: 'water',
    textUz: "Oqayotgan yoki sizib chiqayotgan kranni darhol ta'mirlang yoki xabar bering.",
  },
  { category: 'water', textUz: 'Suvni faqat zarur miqdorda ishlating, behuda oqizmang.' },
  { category: 'water', textUz: 'Hovlini suv bilan uzoq va ortiqcha yuvishdan saqlaning.' },
  {
    category: 'water',
    textUz:
      'Bir daqiqada ochiq qolgan kran taxminan 6 litr suvni behuda oqizadi — buni yodda tuting.',
  },

  // Energiya
  { category: 'energy', textUz: "Xonadan chiqayotganda chiroqni o'chiring." },
  {
    category: 'energy',
    textUz: 'Foydalanilmayotgan elektr qurilmalarini tarmoqdan (rozetkadan) uzing.',
  },
  {
    category: 'energy',
    textUz:
      "Kunduzi imkon qadar tabiiy yorug'likdan foydalaning, chiroqni yoqmang.",
  },
  { category: 'energy', textUz: 'Energiya tejamkor lampalardan foydalaning.' },
  { category: 'energy', textUz: 'Konditsioner ishlayotganda derazani yopiq tuting.' },

  // Chiqindi
  {
    category: 'waste',
    textUz: '"Kamaytir – qayta foydalan – qayta ishlashga topshir" tamoyiliga amal qiling.',
  },
  {
    category: 'waste',
    textUz: "Chiqindilarni turiga qarab ajrating: qog'oz, plastik, shisha, organik, elektron.",
  },
  { category: 'waste', textUz: 'Axlatni yerga emas, faqat maxsus qutiga tashlang.' },
  {
    category: 'waste',
    textUz: 'Bir martalik plastik o‘rniga qayta ishlatiladigan mahsulotlarni tanlang.',
  },
  {
    category: 'waste',
    textUz:
      'Plastik tabiatda juda uzoq vaqt (yuzlab yillar) parchalanadi — undan voz kechishga harakat qiling.',
  },

  // Havo
  { category: 'air', textUz: 'Imkon qadar piyoda yuring yoki velosipeddan foydalaning.' },
  {
    category: 'air',
    textUz: "Jamoat transportidan foydalanish shaxsiy avtomobildan ko'ra ekologikroq.",
  },
  {
    category: 'air',
    textUz: 'Chiqindilarni hech qachon yoqmang — bu havoni kuchli ifloslantiradi.',
  },
  { category: 'air', textUz: 'Daraxt va gullar ekish havoni tozalashga yordam beradi.' },

  // Yashil hudud
  {
    category: 'green',
    textUz: "Yangi daraxt va ko'chatlar eking, ularga muntazam suv bering.",
  },
  { category: 'green', textUz: 'Daraxt shoxlarini sindirmang, gullarni sababsiz uzmang.' },
  {
    category: 'green',
    textUz: "Qurigan yoki shikastlangan daraxt haqida mas'ul shaxsga xabar bering.",
  },

  // Hayvonlar
  {
    category: 'animals',
    textUz: 'Qishda qushlar uchun yemdon tayyorlab, ularga ozuqa qoldiring.',
  },
  { category: 'animals', textUz: "Hayvonlarni qo'rqitmang va ularning uyalarini buzmang." },
  {
    category: 'animals',
    textUz:
      "Chanqagan yoki och hayvonga suv va ozuqa bering, lekin yashash muhitiga aralashmang.",
  },

  // Iqlim
  {
    category: 'climate',
    textUz:
      "Har bir kishi energiyani tejash, suvni tejash, daraxt ekish, chiqindini saralash va ortiqcha iste'molni kamaytirish orqali iqlim o'zgarishiga qarshi hissa qo'sha oladi.",
  },
];
