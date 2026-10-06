'use client';

import {
  Calendar,
  Droplets,
  Leaf,
  MapPin,
  Recycle,
  TreeDeciduous,
  Users,
  Wind,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';
import { formatLongDate } from '@/shared/lib/format-date';
import type { AppLocale } from '@/i18n/request';

// Screenshotdagi ko'rsatkichlar — keyinchalik haqiqiy API ga ulanadi
const STATS = [
  { label: 'Mahalla ekologik indeksi', value: '81%', sub: 'Yaxshi 🌿', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Faol aholi', value: '1 245', sub: 'Ro\'yxatdagi fuqarolar', color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: "O'tkazilgan tadbirlar", value: '8', sub: 'Shu oyda', color: 'text-violet-600', bg: 'bg-violet-50' },
];

const INDICATORS = [
  { label: 'Havo sifati', value: 75, icon: Wind, color: 'bg-sky-500' },
  { label: 'Yashil hududlar', value: 82, icon: TreeDeciduous, color: 'bg-emerald-500' },
  { label: 'Chiqindi boshqarish', value: 78, icon: Recycle, color: 'bg-amber-500' },
  { label: 'Suv tejash', value: 80, icon: Droplets, color: 'bg-cyan-500' },
];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function MahallahomePage() {
  const user = useAuthStore((s) => s.user);
  const locale = useLocale() as AppLocale;

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Mahalla rahbari';
  const org = user?.organization?.nameUz ?? 'Mahalla';
  const dateStr = formatLongDate(new Date(), locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Sarlavha */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Salom, {displayName}!</h1>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{org}</span>
          <span>·</span>
          <span className="capitalize">{dateStr}</span>
        </div>
      </div>

      {/* 3 ta asosiy KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className={cn('mt-2 text-3xl font-bold', s.color)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Ekologik ko'rsatkichlar + Xarita */}
      <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
        {/* Ko'rsatkichlar */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Ekologik ko'rsatkichlar
          </h2>
          <div className="flex flex-col gap-4">
            {INDICATORS.map((ind) => {
              const Icon = ind.icon;
              return (
                <div key={ind.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{ind.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{ind.value}%</span>
                  </div>
                  <ProgressBar value={ind.value} color={ind.color} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Xarita placeholder */}
        <Card className="flex flex-col p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Mahalla xaritasi</h2>
          <div className="flex flex-1 min-h-[200px] items-center justify-center rounded-lg bg-muted/50">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <MapPin className="h-8 w-8" />
              <p className="text-sm">Xarita Phase 4 da ulanadi</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tezkor amallar */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Tezkor amallar</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Faol aholini ko'rish</p>
              <p className="text-xs text-muted-foreground">Mahalla fuqarolari ro'yxati</p>
            </div>
          </button>
          <button className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100">
              <Calendar className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Tadbir rejalashtirish</p>
              <p className="text-xs text-muted-foreground">Yangi ekologik tadbir qo'shish</p>
            </div>
          </button>
          <button className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
              <Leaf className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ekologik hisobot</p>
              <p className="text-xs text-muted-foreground">Oy hisobotini ko'rish</p>
            </div>
          </button>
          <button className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
              <Recycle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Chiqindi monitoring</p>
              <p className="text-xs text-muted-foreground">Chiqindi saralash holati</p>
            </div>
          </button>
        </div>
      </Card>
    </div>
  );
}
