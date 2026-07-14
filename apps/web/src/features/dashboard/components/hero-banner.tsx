'use client';

import { Leaf } from 'lucide-react';
import { useFormatter } from 'next-intl';
import Image from 'next/image';

import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Welcome hero.
 *
 * On lg+ screens the layout is fully horizontal:
 *   [ Welcome + subtitle | eco-city banner ] [ Quote card ]
 *
 * On smaller screens the banner drops beneath the text and the quote card
 * wraps to a full-width row below.
 *
 * The city image is loaded from `apps/web/public/eco-city.png`.
 */
export function HeroBanner() {
  const user = useAuthStore((s) => s.user);
  const format = useFormatter();

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Foydalanuvchi';
  const dateStr = format.dateTime(new Date(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  return (
    <section className="grid gap-4 lg:max-w-[1160px] lg:grid-cols-[minmax(0,1fr),minmax(0,300px)]">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
        <div className="grid gap-4 p-6 md:grid-cols-[minmax(0,1fr),minmax(0,260px)] md:items-center md:gap-5 md:p-7">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Xush kelibsiz, {displayName}!
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Bugun, {dateStr}</p>
          </div>

          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl md:aspect-[16/7]">
            <Image
              src="/eco-city.png"
              alt="Yashil shahar"
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-contain object-center"
              priority
            />
          </div>
        </div>
      </div>

      <div className="flex items-center rounded-2xl border border-primary/20 bg-primary-soft/60 p-5">
        <div className="flex items-start gap-2">
          <p className="text-sm font-medium leading-snug text-foreground">
            &ldquo;Tabiatni asrash – kelajakni asrash demakdir!&rdquo;
          </p>
          <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        </div>
      </div>
    </section>
  );
}
