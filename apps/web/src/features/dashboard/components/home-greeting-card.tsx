'use client';

import { Leaf } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { formatLongDate } from '@/shared/lib/format-date';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { AppLocale } from '@/i18n/request';

/**
 * Bosh sahifa salomlashuv kartasi — chapda ism/sana, o'ngda shior pill.
 * `bosh-sahifa-prompt.md` maketiga mos (faqat SUPER_ADMIN "/" sahifasida).
 */
export function HomeGreetingCard() {
  const t = useTranslations('home');
  const locale = useLocale() as AppLocale;
  const user = useAuthStore((s) => s.user);

  const displayName = user ? `${user.firstName} ${user.lastName}` : '';
  const dateStr = formatLongDate(new Date(), locale);

  return (
    <section className="flex flex-col items-start gap-6 rounded-2xl border border-border/60 bg-card px-7 py-6 shadow-sm min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{t('breadcrumb')}</p>
        <h1 className="mt-1.5 text-[1.75rem] font-bold leading-9 tracking-tight text-foreground">
          {t('welcome', { name: displayName })}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('todayIs', { date: dateStr })}</p>
      </div>

      <div className="flex max-w-xs items-center gap-2.5 rounded-[0.875rem] border border-primary/20 bg-primary-soft/60 px-4 py-3 text-sm font-medium">
        <Leaf className="h-5 w-5 shrink-0 text-primary" />
        <span>{t('slogan')}</span>
      </div>
    </section>
  );
}
