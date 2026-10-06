'use client';

import type {
  QuizPublicDetailDto,
  QuizQuestionPublicDto,
  SubmissionAnswerInput,
} from '@eco/shared';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useSubmitQuiz, useTakeQuiz } from '@/features/quizzes/hooks/use-quizzes';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import type { ApiError } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/cn';

const LIKERT_LABELS: Record<number, string> = {
  1: 'Mutlaqo qo‘shilmayman',
  2: 'Qo‘shilmayman',
  3: 'Qisman qo‘shilaman',
  4: 'Qo‘shilaman',
  5: 'To‘liq qo‘shilaman',
};

/** Standalone test uchun orqaga qaytish havolasi. Dars tagidagi testlar
 *  hozircha monitoring/tests ga ko'chmagan — biz /monitoring/tests ga qaytamiz. */
const BACK_URL = '/monitoring/tests';

export default function TakeQuizPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params?.quizId;
  const router = useRouter();

  const { data: quiz, isLoading, isError } = useTakeQuiz(quizId);
  const submit = useSubmitQuiz(quizId ?? '');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (isError || !quiz) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Test topilmadi</Card>;
  }

  return (
    <TakeQuizView
      quiz={quiz}
      answers={answers}
      setAnswers={setAnswers}
      error={error}
      setError={setError}
      submitting={submit.isPending}
      onBack={() => router.push(BACK_URL)}
      onSubmit={async () => {
        setError(null);
        const payload: SubmissionAnswerInput[] = Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          value,
        }));
        if (payload.length === 0) {
          setError('Hech bir savolga javob bermadingiz');
          return;
        }
        try {
          const result = await submit.mutateAsync({ answers: payload });
          router.push(`/monitoring/tests/${quiz.id}/results/${result.id}`);
        } catch (err) {
          const api = err as ApiError;
          setError(api.message);
        }
      }}
    />
  );
}

interface ViewProps {
  quiz: QuizPublicDetailDto;
  answers: Record<string, string>;
  setAnswers: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  error: string | null;
  setError: (v: string | null) => void;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

function TakeQuizView({ quiz, answers, setAnswers, error, submitting, onBack, onSubmit }: ViewProps) {
  const [page, setPage] = useState(0);
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(quiz.questions.length / perPage));
  const visible = useMemo(() => quiz.questions.slice(page * perPage, (page + 1) * perPage), [quiz.questions, page]);
  const answeredCount = Object.keys(answers).length;

  const isLast = page === totalPages - 1;

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{quiz.questionCount} savol</Badge>
          <Badge variant="secondary">O&apos;tish: {quiz.passPercent}%</Badge>
          <Badge variant="outline">
            Javob berildi: {answeredCount}/{quiz.questions.length}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{quiz.titleUz}</h1>
        {quiz.descriptionUz ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{quiz.descriptionUz}</p>
        ) : null}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((page + 1) / totalPages) * 100}%` }}
        />
      </div>

      <div className="space-y-4">
        {visible.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            order={page * perPage + idx + 1}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </div>

      {error ? (
        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" onClick={() => (page === 0 ? onBack() : setPage((p) => p - 1))}>
          <ArrowLeft className="h-4 w-4" />
          {page === 0 ? 'Chiqish' : 'Oldingi'}
        </Button>
        {isLast ? (
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Testni topshirish
          </Button>
        ) : (
          <Button onClick={() => setPage((p) => p + 1)}>
            Keyingi
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: QuizQuestionPublicDto;
  order: number;
  value: string | undefined;
  onChange: (value: string) => void;
}

function QuestionCard({ question, order, value, onChange }: QuestionCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 pb-3">
        <Badge variant="outline">#{order}</Badge>
        <Badge variant="secondary">
          {question.type === 'SINGLE_CHOICE' ? 'Test' : 'So‘rovnoma (1–5)'}
        </Badge>
      </div>
      <p className="whitespace-pre-wrap text-base font-medium text-foreground">{question.textUz}</p>

      {question.type === 'SINGLE_CHOICE' ? (
        <ul className="mt-4 space-y-2">
          {question.options.map((opt) => {
            const selected = value === opt.key;
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  onClick={() => onChange(opt.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                    selected
                      ? 'border-primary bg-primary-soft/40 text-foreground'
                      : 'border-border/60 bg-card hover:border-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : opt.key}
                  </span>
                  <span className="flex-1">{opt.textUz}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = value === String(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center text-xs transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft/40 text-foreground'
                    : 'border-border/60 bg-card hover:border-primary/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
                  )}
                >
                  {n}
                </span>
                <span className="leading-tight text-muted-foreground">{LIKERT_LABELS[n]}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
