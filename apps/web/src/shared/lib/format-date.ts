import type { AppLocale } from '@/i18n/request';

/**
 * Hand-rolled weekday/month names per locale.
 *
 * Why not `Intl.DateTimeFormat` / next-intl's `useFormatter().dateTime()`?
 * Official Node Docker images are often built with "small-icu" (English-only
 * CLDR data). When the server renders a non-English locale (uz/ru) it silently
 * falls back to a generic, un-localized pattern, while the browser (full ICU)
 * renders the real locale — the two don't match, so React throws a hydration
 * mismatch and the date visibly "flips" right after the page loads. Spelling
 * the names out ourselves keeps server and client output byte-identical,
 * regardless of the runtime's ICU data.
 */
const WEEKDAYS: Record<AppLocale, string[]> = {
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const MONTHS: Record<AppLocale, string[]> = {
  uz: [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ],
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/**
 * Formats a full "weekday, day month year" date, e.g. "payshanba, 1-oktabr, 2026".
 * ICU-independent — safe to call during SSR without risking a hydration mismatch.
 */
export function formatLongDate(date: Date, locale: AppLocale): string {
  const weekday = WEEKDAYS[locale][date.getDay()];
  const month = MONTHS[locale][date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  switch (locale) {
    case 'ru':
      return `${weekday}, ${day} ${month} ${year} г.`;
    case 'en':
      return `${weekday}, ${month} ${day}, ${year}`;
    case 'uz':
    default:
      return `${weekday}, ${day}-${month}, ${year}`;
  }
}
