import { ArrowRight, Award, BookOpen, ClipboardList, LucideIcon, Users } from 'lucide-react';
import Link from 'next/link';

import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { EDUCATION_STATS, type EducationStat } from '../data/mock';

const ICON_BY_KEY: Record<EducationStat['icon'], LucideIcon> = {
  courses:     BookOpen,
  students:    Users,
  assignments: ClipboardList,
  certs:       Award,
};

const CAPTIONS: Record<string, string> = {
  coursesCaption:      "Ekologiya va atrof-muhit mavzusidagi kurslar",
  studentsCaption:     'Bugungi faol foydalanuvchilar',
  assignmentsCaption:  "Faol topshiriqlar soni",
  certsCaption:        'Berilgan sertifikatlar soni',
  coursesCta:          "Kurslarga o'tish",
  studentsCta:         "Batafsil ko'rish",
  assignmentsCta:      "Topshiriqlarga o'tish",
  certsCta:            "Sertifikatlarni ko'rish",
};

const TITLES: Record<EducationStat['key'], string> = {
  courses:        'E-learning kurslari',
  activeStudents: "O'quvchilar faolligi",
  assignments:    'Topshiriqlar',
  certificates:   'Sertifikatlar',
};

const TONE_MAP = {
  primary: 'bg-primary-soft text-primary',
  blue:    'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-primary-soft text-primary',
};

export function EducationCards() {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground">Ta&apos;lim jarayoni</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {EDUCATION_STATS.map((s) => {
          const Icon = ICON_BY_KEY[s.icon];
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
              <div className="mt-4 text-2xl font-bold text-foreground">{s.value}</div>
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
