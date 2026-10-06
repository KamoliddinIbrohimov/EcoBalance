'use client';

import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useMySubmission, useTakeQuiz } from '@/features/quizzes/hooks/use-quizzes';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';

const BACK_URL = '/monitoring/tests';

export default function QuizResultsPage() {
  const params = useParams<{ quizId: string; submissionId: string }>();
  const quizId = params?.quizId;
  const submissionId = params?.submissionId;

  const { data: submission, isLoading } = useMySubmission(submissionId);
  const { data: quiz } = useTakeQuiz(quizId);

  if (isLoading || !submission || !quiz) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </Card>
    );
  }

  const scored = submission.scorePercent !== null;
  const passed = submission.passed === true;

  const answerMap = new Map(submission.answers.map((a) => [a.questionId, a.value]));

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href={BACK_URL}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ekologik testlar
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{quiz.titleUz}</h1>
        <p className="text-sm text-muted-foreground">Topshirish natijasi</p>
      </div>

      {scored ? (
        <Card
          className={cn(
            'flex items-center gap-4 p-6',
            passed ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5',
          )}
        >
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-full',
              passed ? 'bg-success text-primary-foreground' : 'bg-destructive text-primary-foreground',
            )}
          >
            {passed ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Baholash</div>
            <div className="text-2xl font-bold text-foreground">
              {submission.scorePercent}% ({submission.scoreTotal}/{submission.scoreMax})
            </div>
            <div className="text-xs text-muted-foreground">
              O&apos;tish chegarasi: {quiz.passPercent}% ·{' '}
              <span className={passed ? 'text-success' : 'text-destructive'}>
                {passed ? 'O\'tdingiz' : 'Yetarli emas'}
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      {submission.likertMax ? (
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">So&apos;rovnoma yig&apos;indisi</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {submission.likertSum}/{submission.likertMax} ball
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            So&apos;rovnoma qismi baholanmaydi — javoblar o&apos;qituvchi/administratorga umumiy
            motivatsion tasavvur beradi.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">Javoblar</h2>
        <ol className="mt-4 space-y-3">
          {quiz.questions.map((q, idx) => {
            const given = answerMap.get(q.id);
            return (
              <li key={q.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 pb-2">
                  <Badge variant="outline">#{idx + 1}</Badge>
                  <Badge variant="secondary">
                    {q.type === 'SINGLE_CHOICE' ? 'Test' : 'So‘rovnoma'}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{q.textUz}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sizning javobingiz:{' '}
                  <span className="font-semibold text-foreground">{given ?? '— (javob bermagansiz)'}</span>
                </p>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href={BACK_URL}>
            <ArrowLeft className="h-4 w-4" />
            Testlar ro&apos;yxatiga
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/monitoring/tests/${quiz.id}`}>Qayta yechish</Link>
        </Button>
      </div>
    </div>
  );
}
