import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const LOCALES = ['uz', 'ru', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'uz';
export const LOCALE_COOKIE = 'eco-locale';

export default getRequestConfig(async () => {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = (LOCALES as readonly string[]).includes(raw ?? '')
    ? (raw as AppLocale)
    : DEFAULT_LOCALE;

  return {
    locale,
    timeZone: 'Asia/Tashkent',
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
