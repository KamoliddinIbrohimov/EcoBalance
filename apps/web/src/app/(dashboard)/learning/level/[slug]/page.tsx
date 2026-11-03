import { redirect } from 'next/navigation';

/**
 * Ta'lim darajalari olib tashlangan — platforma faqat oliy ta'lim uchun.
 * Eski havolalar (bookmark, bildirishnoma) kurslar ro'yxatiga yo'naltiriladi.
 */
export default function LegacyLevelPage() {
  redirect('/learning');
}
