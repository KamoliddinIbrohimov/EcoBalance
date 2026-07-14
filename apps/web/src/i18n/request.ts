import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = 'uz';
  return {
    locale,
    timeZone: 'Asia/Tashkent',
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
