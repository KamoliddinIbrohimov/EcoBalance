'use client';

import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  ClipboardList,
  Clock,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { apiClient } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format-date';

interface Overview {
  studentId: string;
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
  weeklyActivity: Record<string, number>;
  overdueAssignments: number;
  risks: string[];
}

interface TimelineEvent {
  id: string;
  type: string;
  refId: string | null;
  meta: unknown;
  at: string;
}

const RISK_LABEL: Record<string, string> = {
  inactive_7d: '7+ kun faolsiz',
  low_avg_score: "O'rtacha ball 50% dan past",
  overdue_2plus: '2+ muddati o‘tgan topshiriq',
};

const EVENT_LABEL: Record<string, string> = {
  LESSON_OPEN: 'Dars ochildi',
  LESSON_HEARTBEAT: 'Dars o‘qildi',
  LESSON_COMPLETE: 'Dars tugatildi',
  MATERIAL_OPEN: 'Material ochildi',
  QUIZ_START: 'Test boshlandi',
  QUIZ_SUBMIT: 'Test topshirildi',
  ASSIGNMENT_OPEN: 'Topshiriq ochildi',
  ASSIGNMENT_SUBMIT: 'Topshiriq topshirildi',
};

export default function StudentCardPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data: overview, isLoading } = useQuery({
    queryKey: ['stats', 'student', id, 'overview'],
    queryFn: async () => {
      const r = await apiClient.get<{ data: Overview }>(`/stats/students/${id}/overview`);
      return r.data.data;
    },
    enabled: !!id,
  });

  const { data: timeline } = useQuery({
    queryKey: ['stats', 'student', id, 'timeline'],
    queryFn: async () => {
      const r = await apiClient.get<{ data: TimelineEvent[] }>(`/stats/students/${id}/timeline`);
      return r.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (!overview) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Talaba topilmadi
      </Card>
    );
  }

  const hours = Math.floor(overview.totalStudyTimeSec / 3600);
  const minutes = Math.floor((overview.totalStudyTimeSec % 3600) / 60);
  const timeLabel = hours > 0 ? `${hours} s ${minutes} daq` : `${minutes} daq`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Talaba statistikasi
        </h1>
      </div>

      {overview.risks.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">E‘tibor kerak:</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {overview.risks.map((r) => (
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
          value={`${overview.lessonsCompleted}/${overview.lessonsTotal}`}
          sub={`${overview.progressPercent}% tugatildi`}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Testlar"
          value={`${overview.quizzesPassed}/${overview.quizzesTaken}`}
          sub={
            overview.quizzesAverageScore !== null
              ? `o'rtacha ${overview.quizzesAverageScore}%`
              : '—'
          }
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Topshiriqlar"
          value={`${overview.assignmentsGraded}/${overview.assignmentsSubmitted}`}
          sub={
            overview.assignmentsAverageScore !== null
              ? `o'rtacha ${overview.assignmentsAverageScore}%`
              : '—'
          }
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="O'qish vaqti"
          value={timeLabel}
          sub={
            overview.lastActivityAt
              ? `oxirgi: ${formatDateTime(new Date(overview.lastActivityAt))}`
              : 'yo‘q'
          }
        />
      </div>

      {overview.overdueAssignments > 0 ? (
        <Card className="p-4 text-sm">
          <span className="font-semibold text-destructive">
            {overview.overdueAssignments}
          </span>{' '}
          muddati o‘tgan topshiriq
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Haftalik faollik
        </h2>
        <ul className="space-y-1 text-sm">
          {Object.entries(overview.weeklyActivity).length === 0 ? (
            <li className="text-muted-foreground">So‘nggi 7 kun faolligi yo‘q</li>
          ) : (
            Object.entries(overview.weeklyActivity).map(([type, count]) => (
              <li key={type} className="flex items-center justify-between gap-2">
                <span>{EVENT_LABEL[type] ?? type}</span>
                <Badge variant="secondary">{count}</Badge>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-4 w-4" />
          Timeline (so‘nggi faoliyatlar)
        </h2>
        {!timeline || timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hodisalar yo‘q</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {timeline.slice(0, 30).map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-2 border-b border-border/40 pb-2 last:border-0"
              >
                <span>{EVENT_LABEL[e.type] ?? e.type}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(new Date(e.at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold text-foreground">{value}</div>
        {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
      </div>
    </Card>
  );
}
