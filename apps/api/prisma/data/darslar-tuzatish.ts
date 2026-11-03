/**
 * Oliy ta'lim darslaridagi ma'lumot nomuvofiqliklarini tuzatadi:
 * - PDV amaliy darslari (16–22) nomi biriktirilgan docx mavzusiga moslanadi —
 *   faqat nom hali eski (seed) qiymatida bo'lsa, o'qituvchi o'zgartirgan nomga tegilmaydi;
 * - maqsad maydoniga tushib qolgan "Qisqacha nazariy ma'lumot" qismi kesiladi
 *   (u nazariya bo'limida allaqachon bor).
 */
import type { PrismaClient } from '@prisma/client';

const PDV_SLUG = 'pedagogik-dasturiy-vositalar';

const PDV_AMALIY_TITLES: Array<[orderIndex: number, oldTitle: string, newTitle: string]> = [
  [16, '1-amaliy: PDV tahlili va taqqoslash', '1-amaliy: Pedagogik dasturiy vositalarni loyihalashtirish'],
  [17, '2-amaliy: Virtual laboratoriya modeli yaratish', '2-amaliy: Camtasia yoki Bandicam yordamida o‘quv videosini yaratish'],
  [18, '3-amaliy: Video dars tayyorlash (Camtasia)', '3-amaliy: Elektron nazorat va diagnostika vositasini yaratish'],
  [19, '4-amaliy: iSpring bilan interaktiv modul', '4-amaliy: iSpringda 3D kitob, timeline va interaktiv resurs yaratish'],
  [20, '5-amaliy: Moodle kurs sozlash va test', '5-amaliy: iSpringda glossariy va interaktiv topshiriqlarni yaratish'],
  [21, '6-amaliy: Elektron darslik loyihasi', '6-amaliy: Elektron darslik fragmentini yaratish'],
  [22, '7-amaliy: Pedagogik dasturiy vosita yakuniy loyihasi', '7-amaliy: Multimedia ilova yaratish va uning samaradorligini baholash'],
];

const THEORY_MARKER = /\n\s*Qisqacha nazariy ma[‘'`’ʼ]lumot[\s\S]*$/;

export async function fixDarslar(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  let renamed = 0;
  for (const [orderIndex, oldTitle, titleUz] of PDV_AMALIY_TITLES) {
    const { count } = await prisma.lesson.updateMany({
      where: { course: { slug: PDV_SLUG }, orderIndex, titleUz: oldTitle },
      data: { titleUz },
    });
    renamed += count;
  }

  const spilled = await prisma.lesson.findMany({
    where: { course: { educationLevel: 'oliy-talim' }, objectiveUz: { contains: 'Qisqacha nazariy ma' } },
    select: { id: true, objectiveUz: true },
  });
  for (const l of spilled) {
    const objectiveUz = l.objectiveUz!.replace(THEORY_MARKER, '').replace(/\n{3,}/g, '\n\n').trim();
    await prisma.lesson.update({ where: { id: l.id }, data: { objectiveUz } });
  }

  log(`✓ Darslar tuzatildi: ${renamed} ta nom mavzuga moslandi, ${spilled.length} ta maqsad tozalandi`);
  return true;
}
