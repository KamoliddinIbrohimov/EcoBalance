'use client';

import { ArrowRight, BookOpen, FileText, GraduationCap, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import { useCoursesList } from '@/features/learning/hooks/use-learning';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { EDUCATION_STATS, type EducationStat } from '../data/mock';

const ICON_BY_KEY: Record<EducationStat['icon'], LucideIcon> = {
  levels:    Layers,
  courses:   BookOpen,
  lessons:   GraduationCap,
  materials: FileText,
};

const CAPTIONS: Record<string, string> = {
  levelsCaption:    "Maktabgacha, Maktab va Oliy ta'lim bo'limlari",
  coursesCaption:   'Har darajaga mos ekologiya kursi',
  lessonsCaption:   'Amaliy, laboratoriya va ekskursiya darslar',
  materialsCaption: 'Yuklab olish uchun docx metodichkalar',
  levelsCta:        "Darajalar ro'yxati",
  coursesCta:       "Kurslarga o'tish",
  lessonsCta:       "Darslarga o'tish",
  materialsCta:     "Materiallarni ko'rish",
};

const TITLES: Record<EducationStat['key'], string> = {
  levels:    "Ta'lim darajalari",
  courses:   'E-learning kurslari',
  lessons:   'Darslar',
  materials: 'Metodik materiallar',
};

const TONE_MAP = {
  primary: 'bg-primary-soft text-primary',
  blue:    'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-primary-soft text-primary',
};

export function EducationCards() {
  const { data: levels } = useEducationLevels();
  const { data: coursesData } = useCoursesList({ page: 1, perPage: 200, isPublished: true });

  // Real DB'dan kelgan qiymatlar. Backend ma'lumot bermasa mock qiymatlar
  // (docs/materials/ dan olingan sonlar) fallback bo'ladi.
  const liveValues = useMemo(() => {
    const map: Record<EducationStat['key'], string | null> = {
      levels: levels ? `${levels.length} daraja` : null,
      courses: coursesData ? `${coursesData.data.length} kurs` : null,
      lessons: coursesData
        ? `${coursesData.data.reduce((s, c) => s + (c.lessonsCount ?? 0), 0)} dars`
        : null,
      // Materials count backend'da alohida totalsda yo'q — mockdan olamiz.
      materials: null,
    };
    return map;
  }, [levels, coursesData]);

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground">Ta&apos;lim jarayoni</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {EDUCATION_STATS.map((s) => {
          const Icon = ICON_BY_KEY[s.icon];
          const value = liveValues[s.key] ?? s.value;
          return (
            <Card key={s.key} className="p-5">
              <div className="flex items-start gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', TONE_MAP[s.tone])}>
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{TITLES[s.key]}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{CAPTIONS[s.captionKey]}</div>
                </div>
              </div>
              <div className="mt-4 text-2xl font-bold text-foreground">{value}</div>
              <Link
                href={s.href}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:underline"
              >
                {CAPTIONS[s.ctaKey]}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
