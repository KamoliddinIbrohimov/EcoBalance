'use client';

import type { StudentStatsDto } from '@eco/shared';
import { Award, BookOpen, ClipboardList, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/shared/components/ui/card';
import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * STUDENT uchun bosh sahifa — LMS progress, yaqin topshiriqlar, oxirgi natijalar.
 * TEACHER/SUPER_ADMIN bu sahifaga tushsa — tegishli bosh sahifaga yo'naltirmaymiz
 * (middleware ichida boshqa oqim), lekin minimal ko'rinish beramiz.
 */
export default function StudentHomePage() {
  const user = useAuthStore((s) => s.user);
  const isStudent = user?.roles?.includes('STUDENT') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('TEACHER');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', 'me'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: StudentStatsDto | null }>('/stats/me');
      return res.data.data;
    },
    enabled: !!isStudent,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Salom, {user?.firstName ?? ''}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O&apos;qish jarayoniga xush kelibsiz. Darslar, testlar va topshiriqlar quyida.
        </p>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : stats ? (
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Darslar"
            value={`${stats.lessonsCompleted}/${stats.lessonsTotal}`}
            sub={`${stats.progressPercent}% tugatildi`}
            href="/learning"
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Testlar"
            value={`${stats.quizzesPassed}/${stats.quizzesTaken}`}
            sub={stats.quizzesAverageScore !== null ? `o'rtacha ${stats.quizzesAverageScore}%` : 'hali yechilmagan'}
            href="/monitoring/tests"
          />
          <StatCard
            icon={<Award className="h-5 w-5" />}
            label="Topshiriqlar"
            value={`${stats.assignmentsGraded}/${stats.assignmentsSubmitted}`}
            sub={stats.assignmentsAverageScore !== null ? `o'rtacha ball ${stats.assignmentsAverageScore}` : 'hali topshirilmagan'}
            href="/assignments"
          />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <ActionCard title="Darslarim" subtitle="Guruhingizga biriktirilgan kurslar" href="/learning" />
        <ActionCard title="Topshiriqlar" subtitle="Yangi va yechilmagan topshiriqlar" href="/assignments" />
        <ActionCard title="Ekologik testlar" subtitle="Nashr etilgan testlar" href="/monitoring/tests" />
        <ActionCard title="Natijalarim" subtitle="To'liq statistika" href="/stats/me" />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-3 p-5 transition-colors hover:border-primary/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-foreground">{value}</div>
          {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
        </div>
      </Card>
    </Link>
  );
}

function ActionCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="flex h-full items-center justify-between gap-3 p-5 transition-colors hover:border-primary/40">
        <div>
          <div className="font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <div className="text-primary">→</div>
      </Card>
    </Link>
  );
}
