'use client';

import { PERMISSION, type QuizSummaryDto } from '@eco/shared';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { QuizEditorDialog } from '@/features/quizzes/components/quiz-editor-dialog';
import { QuizFormDialog } from '@/features/quizzes/components/quiz-form-dialog';
import {
  useAdminQuizzes,
  useRemoveQuiz,
} from '@/features/quizzes/hooks/use-quizzes';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function ManageTestsPage() {
  const canManage = useAuthStore((s) => s.hasPermission(PERMISSION.QUIZZES_MANAGE));

  const { data, isLoading } = useAdminQuizzes({ standaloneOnly: true, perPage: 50 });
  const quizzes = data?.data ?? [];

  const removeQuiz = useRemoveQuiz();

  const [formOpen, setFormOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizSummaryDto | null>(null);
  const [removingQuiz, setRemovingQuiz] = useState<QuizSummaryDto | null>(null);
  const [editorQuizId, setEditorQuizId] = useState<string | null>(null);

  if (!canManage) {
    return <UnderDevelopment description="Testlarni boshqarish uchun ruxsatingiz yo'q." />;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/monitoring/tests"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ekologik testlar
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Testlarni boshqarish
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ekologik monitoring bo&apos;limi uchun testlar: yaratish, tahrirlash, nashr etish va
              natijalarni ko&apos;rish.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingQuiz(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi test
        </Button>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : quizzes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hali testlar yo&apos;q. &quot;Yangi test&quot; tugmasi orqali boshlang.
        </Card>
      ) : (
        <ul className="space-y-2">
          {quizzes.map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setEditorQuizId(q.id)}
                  className="truncate text-left text-sm font-semibold text-foreground hover:underline"
                >
                  {q.titleUz}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary">{q.questionCount} savol</Badge>
                  <Badge variant="secondary">{q.submissionCount} topshiriq</Badge>
                  <Badge variant={q.isPublished ? 'default' : 'outline'}>
                    {q.isPublished ? 'Nashr etilgan' : 'Qoralama'}
                  </Badge>
                  <span>O&apos;tish: {q.passPercent}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  aria-label="Natijalar"
                  title="Natijalarni ko'rish"
                >
                  <Link href={`/monitoring/tests/manage/${q.id}/submissions`}>
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingQuiz(q);
                    setFormOpen(true);
                  }}
                  aria-label="Tahrirlash"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setRemovingQuiz(q)}
                  aria-label="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuizFormDialog open={formOpen} onOpenChange={setFormOpen} quiz={editingQuiz} />
      <QuizEditorDialog quizId={editorQuizId} onClose={() => setEditorQuizId(null)} />

      <ConfirmDialog
        open={!!removingQuiz}
        onOpenChange={(v) => !v && setRemovingQuiz(null)}
        title={`"${removingQuiz?.titleUz ?? ''}" testini o'chirasizmi?`}
        description="Test va uning barcha savollari hamda topshiriqlari butunlay o'chiriladi."
        confirmLabel="Ha, o'chirish"
        loading={removeQuiz.isPending}
        onConfirm={() => {
          if (!removingQuiz) return;
          removeQuiz.mutate(removingQuiz.id, {
            onSuccess: () => setRemovingQuiz(null),
          });
        }}
      />
    </div>
  );
}
