'use client';

import { AlertTriangle, Award, BookOpen, ClipboardList, Clock, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { apiClient } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format-date';
import { useAuthStore } from '@/shared/stores/auth-store';

interface Overview {
  lessonsTotal: number;
  lessonsCompleted: number;
  progressPercent: number;
  quizzesTaken: number;
  quizzesPassed: number;
  quizzesAverageScore: number | null;
  assignmentsSubmitted: number;
  assignmentsGraded: number;
  assignmentsAverageScore: number | null;
  totalStudyTimeSec: number;
  lastActivityAt: string | null;
  overdueAssignments: number;
  risks: string[];
}

const RISK_LABEL: Record<string, string> = {
  inactive_7d: '7+ kun faolsiz',
  low_avg_score: "O'rtacha ball 50% dan past",
  overdue_2plus: '2+ muddati o‘tgan topshiriq',
};

export default function MyStatsPage() {
  const user = useAuthStore((s) => s.user);
  const isStudent = user?.roles?.includes('STUDENT');

  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'me', 'overview'],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await apiClient.get<{ data: Overview }>(`/stats/students/${user.id}/overview`);
      return res.data.data;
    },
    enabled: !!isStudent && !!user?.id,
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

      {data.risks.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">E&apos;tibor kerak:</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {data.risks.map((r) => (
                    <li key={r}>{RISK_LABEL[r] ?? r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
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
          sub={data.assignmentsAverageScore !== null ? `o'rtacha ${data.assignmentsAverageScore}%` : '—'}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="O'qish vaqti"
          value={formatStudyTime(data.totalStudyTimeSec)}
          sub={
            data.lastActivityAt
              ? `oxirgi: ${formatDateTime(new Date(data.lastActivityAt))}`
              : 'yo‘q'
          }
        />
      </div>

      {data.overdueAssignments > 0 ? (
        <Card className="p-4 text-sm">
          <span className="font-semibold text-destructive">{data.overdueAssignments}</span>{' '}
          muddati o&apos;tgan topshiriq
        </Card>
      ) : null}
    </div>
  );
}

function formatStudyTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} s ${m} daq`;
  if (m > 0) return `${m} daq`;
  return `${s} son`;
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
