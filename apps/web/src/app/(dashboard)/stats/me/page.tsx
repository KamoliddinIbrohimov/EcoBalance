'use client';

import type { StudentStatsDto } from '@eco/shared';
import { Award, BookOpen, ClipboardList, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { apiClient } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format-date';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function MyStatsPage() {
  const user = useAuthStore((s) => s.user);
  const isStudent = user?.roles?.includes('STUDENT');

  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'me'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: StudentStatsDto | null }>('/stats/me');
      return res.data.data;
    },
    enabled: !!isStudent,
  });

  if (!isStudent) {
    return <UnderDevelopment description="Ushbu bo'lim faqat talabalar uchun." />;
  }

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Statistika mavjud emas — hozircha dars, test yoki topshiriq ko&apos;rilmagan.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Natijalarim</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Darslar, testlar va topshiriqlar bo&apos;yicha umumiy statistika.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Darslar"
          value={`${data.lessonsCompleted}/${data.lessonsTotal}`}
          sub={`${data.progressPercent}% tugatildi`}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Testlar"
          value={`${data.quizzesPassed}/${data.quizzesTaken}`}
          sub={data.quizzesAverageScore !== null ? `o'rtacha ${data.quizzesAverageScore}%` : '—'}
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Topshiriqlar"
          value={`${data.assignmentsGraded}/${data.assignmentsSubmitted}`}
          sub={data.assignmentsAverageScore !== null ? `o'rtacha ball ${data.assignmentsAverageScore}` : '—'}
        />
      </div>

      {data.lastActivityAt ? (
        <Card className="p-4 text-xs text-muted-foreground">
          Oxirgi faollik: {formatDateTime(new Date(data.lastActivityAt))}
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-foreground">{value}</div>
          {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
        </div>
      </div>
    </Card>
  );
}
