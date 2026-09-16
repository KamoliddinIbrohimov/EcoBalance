'use client';

import { Leaf } from 'lucide-react';
import { useFormatter } from 'next-intl';

import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Welcome hero — sarlavha + sana chap tomonda, iqtibos kartasi o‘ng tomonda.
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
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-card sm:p-6 md:p-7">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
          Xush kelibsiz, {displayName}!
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">Bugun, {dateStr}</p>
      </div>

      <div className="flex items-center rounded-2xl border border-primary/20 bg-primary-soft/60 p-4 sm:p-5">
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
