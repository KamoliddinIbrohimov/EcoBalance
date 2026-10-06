'use client';

import {
  BookOpen,
  Droplets,
  Leaf,
  Recycle,
  TreeDeciduous,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

import { useCoursesList } from '@/features/learning/hooks/use-learning';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { formatLongDate } from '@/shared/lib/format-date';
import type { AppLocale } from '@/i18n/request';

// ---------------------------------------------------------------
// Ekologik missiyalar — birinchi navbatda statik
// ---------------------------------------------------------------
const MISSIONS = [
  {
    icon: TreeDeciduous,
    label: '1 ta daraxt eking',
    points: 50,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Recycle,
    label: 'Chiqindilarni ajrating',
    points: 40,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Droplets,
    label: 'Suvni tejang',
    points: 30,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
];

// ---------------------------------------------------------------
// Shaxsiy ekologik indeks — hozircha mock
// ---------------------------------------------------------------
const ECO_INDEX = 85;

function EcoIndexRing({ value }: { value: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  const color = value >= 70 ? '#22c55e' : value >= 40 ? '#f59e0b' : '#ef4444';
  const label = value >= 70 ? 'Yaxshi' : value >= 40 ? "O'rta" : 'Yomon';

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="-rotate-90" width={112} height={112}>
        <circle cx={56} cy={56} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle
          cx={56}
          cy={56}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

export function UserHomePage() {
  const user = useAuthStore((s) => s.user);
  const locale = useLocale() as AppLocale;
  const { data: coursesData } = useCoursesList({ page: 1, perPage: 3, isPublished: true });

  const displayName = user ? `${user.firstName}` : 'Foydalanuvchi';
  const dateStr = formatLongDate(new Date(), locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Salom satri */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Salom, {displayName}!</h1>
        <p className="mt-0.5 text-sm text-muted-foreground capitalize">{dateStr}</p>
      </div>

      {/* Ekologik indeks + Tavsiya etilgan kurslar */}
      <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
        {/* Indeks */}
        <Card className="flex flex-col items-center gap-3 p-6">
          <p className="text-sm font-semibold text-foreground">Bugungi ekologik indeksingiz</p>
          <EcoIndexRing value={ECO_INDEX} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>O'tgan haftaga nisbatan +3 ball</span>
          </div>
        </Card>

        {/* Tavsiya etilgan kurslar */}
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Tavsiya etilgan kurslar</p>
            <Link
              href="/learning"
              className="text-xs font-medium text-primary hover:underline"
            >
              Barchasini ko'rish →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {coursesData?.data.length ? (
              coursesData.data.map((course) => (
                <Link
                  key={course.id}
                  href={`/learning/${course.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{course.nameUz}</p>
                    <p className="text-xs text-muted-foreground">{course.lessonsCount} dars</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Kurslar yuklanmoqda…
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Ekologik missiyalar */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Ekologik missiyalar</h2>
        <div className="flex flex-col gap-2">
          {MISSIONS.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', m.bg)}>
                    <Icon className={cn('h-4 w-4', m.color)} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Leaf className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600">+{m.points} bal</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
