'use client';

import {
  Bird,
  Droplets,
  Lightbulb,
  Recycle,
  Thermometer,
  TreePine,
  Wind,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  CATEGORY_LABELS_UZ,
  ECO_TIPS,
  type EcoTipCategory,
} from '@/features/recommendations/data/tips';

const CATEGORY_ICONS: Record<EcoTipCategory, LucideIcon> = {
  water: Droplets,
  energy: Zap,
  waste: Recycle,
  air: Wind,
  green: TreePine,
  animals: Bird,
  climate: Thermometer,
};

const CATEGORY_TONE: Record<EcoTipCategory, string> = {
  water: 'bg-info-soft text-info',
  energy: 'bg-warning-soft text-warning',
  waste: 'bg-primary-soft text-primary',
  air: 'bg-info-soft text-info',
  green: 'bg-primary-soft text-primary',
  animals: 'bg-warning-soft text-warning',
  climate: 'bg-destructive/10 text-destructive',
};

const ALL = '__all__';

// NOTE: kelajakda `docs/AI-CHATBOT-PROMPT.md` ishga tushganda bu ro'yxat
// foydalanuvchining o'z EcoReport'lari yoki AI suhbatlari asosida
// shaxsiylashtirilishi mumkin — hozircha statik.

export default function RecommendationsPage() {
  const [category, setCategory] = useState<string>(ALL);

  const filtered =
    category === ALL
      ? ECO_TIPS
      : ECO_TIPS.filter((t) => t.category === category);

  const counts = Object.keys(CATEGORY_LABELS_UZ).reduce<Record<string, number>>(
    (acc, key) => {
      acc[key] = ECO_TIPS.filter((t) => t.category === key).length;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tavsiyalar</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kundalik hayotda amal qilish uchun ekologik maslahatlar. Jami{' '}
              {ECO_TIPS.length} ta.
            </p>
          </div>
        </div>

        <div className="min-w-[200px]">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Toifa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                Barchasi ({ECO_TIPS.length})
              </SelectItem>
              {(Object.keys(CATEGORY_LABELS_UZ) as EcoTipCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS_UZ[c]} ({counts[c]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Bu toifada tavsiyalar yo&apos;q.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tip, i) => {
            const Icon = CATEGORY_ICONS[tip.category];
            return (
              <Card key={`${tip.category}-${i}`} className="flex gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${CATEGORY_TONE[tip.category]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className="mb-1.5">
                    {CATEGORY_LABELS_UZ[tip.category]}
                  </Badge>
                  <p className="text-sm leading-snug text-foreground">{tip.textUz}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
