'use client';

import { PERMISSION } from '@eco/shared';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useAdminQuizDetail,
  useQuizSubmissions,
} from '@/features/quizzes/hooks/use-quizzes';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { PaginationBar } from '@/shared/components/ui/pagination-bar';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';

const DATE_FMT = new Intl.DateTimeFormat('uz-UZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function QuizSubmissionsPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params?.quizId;

  const canManage = useAuthStore((s) => s.hasPermission(PERMISSION.QUIZZES_MANAGE));
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data: quiz } = useAdminQuizDetail(quizId);
  const { data, isLoading } = useQuizSubmissions(quizId, { page, perPage });

  if (!canManage) {
    return <UnderDevelopment description="Natijalarni ko'rish uchun ruxsat yo'q." />;
  }

  const rows = data?.data ?? [];

  const stats = rows.reduce(
    (acc, s) => {
      if (s.scorePercent !== null) {
        acc.scoredCount += 1;
        acc.avgScore += s.scorePercent;
        if (s.passed) acc.passedCount += 1;
      }
      return acc;
    },
    { scoredCount: 0, avgScore: 0, passedCount: 0 },
  );
  if (stats.scoredCount > 0) stats.avgScore = Math.round(stats.avgScore / stats.scoredCount);

  return (
    <div className="space-y-5">
      <Link
        href="/monitoring/tests/manage"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Testlarni boshqarish
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          Test natijalari
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {quiz?.titleUz ?? 'Natijalar'}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Jami topshiriq" value={data?.meta.total ?? 0} />
        <StatCard label="O'rtacha ball (sahifa)" value={stats.scoredCount > 0 ? `${stats.avgScore}%` : '—'} />
        <StatCard
          label="O'tganlar (sahifa)"
          value={stats.scoredCount > 0 ? `${stats.passedCount}/${stats.scoredCount}` : '—'}
        />
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foydalanuvchi</TableHead>
                <TableHead>Ball</TableHead>
                <TableHead>So'rovnoma</TableHead>
                <TableHead>Topshirgan</TableHead>
                <TableHead className="text-right">Holat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={5}>Hali topshiriqlar yo&apos;q</TableEmpty>
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">
                        {s.user.firstName} {s.user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.user.email}</div>
                    </TableCell>
                    <TableCell>
                      {s.scorePercent !== null ? (
                        <span className="font-mono text-sm">
                          <span
                            className={cn(
                              'font-semibold',
                              s.passed ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {s.scorePercent}%
                          </span>{' '}
                          <span className="text-muted-foreground">
                            ({s.scoreTotal}/{s.scoreMax})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.likertMax ? (
                        <span className="font-mono text-sm text-foreground">
                          {s.likertSum}/{s.likertMax}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.submittedAt ? DATE_FMT.format(new Date(s.submittedAt)) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.passed === null ? (
                        <Badge variant="outline">So&apos;rovnoma</Badge>
                      ) : s.passed ? (
                        <Badge className="bg-success text-primary-foreground">
                          <CheckCircle2 className="h-3 w-3" />
                          O&apos;tdi
                        </Badge>
                      ) : (
                        <Badge className="bg-destructive text-primary-foreground">
                          <XCircle className="h-3 w-3" />
                          Yetarli emas
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        {data?.meta ? (
          <PaginationBar meta={data.meta} onPageChange={setPage} itemLabel="ta topshiriq" />
        ) : null}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </Card>
  );
}
