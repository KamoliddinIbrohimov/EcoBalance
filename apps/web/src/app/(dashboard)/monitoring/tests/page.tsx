'use client';

import { PERMISSION, type QuizSummaryDto } from '@eco/shared';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Play,
  Settings,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import {
  useMonitoringTests,
  useMyHistory,
} from '@/features/quizzes/hooks/use-quizzes';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function MonitoringTestsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canTake = hasPermission(PERMISSION.QUIZZES_TAKE);
  const canManage = hasPermission(PERMISSION.QUIZZES_MANAGE);

  const { data, isLoading } = useMonitoringTests();

  if (!canTake) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ekologik testlar
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ekologik savodxonlik va kasbiy diagnostika testlari. Natijalaringiz saqlanadi va
              topshirgandan so&apos;ng o&apos;qituvchingizga yetkaziladi.
            </p>
          </div>
        </div>
        {canManage ? (
          <Button asChild variant="outline">
            <Link href="/monitoring/tests/manage">
              <Settings className="h-4 w-4" />
              Testlarni boshqarish
            </Link>
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : !data || data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hozircha nashr etilgan test yo&apos;q. Keyinroq qayting.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((q) => (
            <TestCard key={q.id} quiz={q} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface QuizWithBinding extends QuizSummaryDto {
  binding?: {
    opensAt: string | null;
    closesAt: string | null;
    maxAttempts: number | null;
    timeLimitMinutes: number | null;
    attemptsUsed: number;
  };
}

function TestCard({ quiz }: { quiz: QuizWithBinding }) {
  const { data: history } = useMyHistory(quiz.id);
  const latest = history?.[0] ?? null;

  const now = Date.now();
  const binding = quiz.binding;
  const closed = binding?.closesAt && new Date(binding.closesAt).getTime() < now;
  const notYet = binding?.opensAt && new Date(binding.opensAt).getTime() > now;
  const attemptsLeft =
    binding?.maxAttempts !== null && binding?.maxAttempts !== undefined
      ? binding.maxAttempts - (binding.attemptsUsed ?? 0)
      : null;
  const noAttempts = attemptsLeft !== null && attemptsLeft <= 0;
  const disabled = closed || notYet || noAttempts;

  return (
    <li>
      <Card className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-base font-semibold text-foreground">{quiz.titleUz}</h2>
            {quiz.descriptionUz ? (
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {quiz.descriptionUz}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary">{quiz.questionCount} savol</Badge>
          <span>O&apos;tish: {quiz.passPercent}%</span>
          {binding?.timeLimitMinutes ? (
            <Badge variant="outline">
              <Clock className="h-3 w-3" />
              {binding.timeLimitMinutes} daq
            </Badge>
          ) : null}
          {attemptsLeft !== null ? (
            <Badge variant={attemptsLeft > 0 ? 'secondary' : 'destructive'}>
              Urinish: {binding!.attemptsUsed}/{binding!.maxAttempts}
            </Badge>
          ) : null}
          {binding?.opensAt ? (
            <span>Ochildi: {new Date(binding.opensAt).toLocaleString('ru-RU')}</span>
          ) : null}
          {binding?.closesAt ? (
            <span>Yopiladi: {new Date(binding.closesAt).toLocaleString('ru-RU')}</span>
          ) : null}
          {latest ? (
            latest.scorePercent === null ? (
              <Badge variant="outline">So&apos;rovnoma topshirildi</Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  'gap-1',
                  latest.passed
                    ? 'border-success/60 text-success'
                    : 'border-destructive/60 text-destructive',
                )}
              >
                {latest.passed ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {latest.scorePercent}%
              </Badge>
            )
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-[11px] text-muted-foreground">
            {closed
              ? 'Yopildi'
              : notYet
                ? "Hali ochilmagan"
                : noAttempts
                  ? "Urinishlar tugadi"
                  : null}
          </span>
          <Button asChild size="sm" disabled={!!disabled}>
            <Link href={disabled ? '#' : `/monitoring/tests/${quiz.id}`}>
              {disabled ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {latest && !disabled ? 'Qayta yechish' : disabled ? 'Yopiq' : 'Boshlash'}
            </Link>
          </Button>
        </div>
      </Card>
    </li>
  );
}
