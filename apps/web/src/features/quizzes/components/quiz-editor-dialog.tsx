'use client';

import {
  QUIZ_QUESTION_TYPE_LABELS_UZ,
  type QuizQuestionAdminDto,
} from '@eco/shared';
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

import {
  useAdminQuizDetail,
  useRemoveQuestion,
  useUpdateQuiz,
} from '../hooks/use-quizzes';
import { QuestionFormDialog } from './question-form-dialog';

interface QuizEditorDialogProps {
  quizId: string | null;
  onClose: () => void;
}

export function QuizEditorDialog({ quizId, onClose }: QuizEditorDialogProps) {
  const open = !!quizId;
  const { data, isLoading } = useAdminQuizDetail(quizId);
  const updateQuiz = useUpdateQuiz();
  const removeQuestion = useRemoveQuestion(quizId ?? '');

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestionAdminDto | null>(null);
  const [removingQuestion, setRemovingQuestion] = useState<QuizQuestionAdminDto | null>(null);

  async function handleTogglePublish() {
    if (!data) return;
    await updateQuiz.mutateAsync({
      id: data.id,
      input: { isPublished: !data.isPublished },
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {data?.titleUz ?? 'Test tahrirlagich'}
            </DialogTitle>
            {data ? (
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{data.questionCount} savol</Badge>
                <Badge variant="secondary">O&apos;tish: {data.passPercent}%</Badge>
                <Badge variant={data.isPublished ? 'default' : 'outline'}>
                  {data.isPublished ? 'Nashr etilgan' : 'Qoralama'}
                </Badge>
                <span>
                  {data.lesson ? (
                    <>
                      Dars: <span className="font-medium text-foreground">{data.lesson.titleUz}</span>
                    </>
                  ) : (
                    <>Ekologik monitoring testi</>
                  )}
                </span>
              </div>
            ) : null}
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto px-6 pb-6">
            {isLoading || !data ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePublish}
                    disabled={updateQuiz.isPending}
                  >
                    {data.isPublished ? (
                      <>
                        <EyeOff className="h-4 w-4" /> Nashrdan olish
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" /> Nashr etish
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setEditingQuestion(null);
                      setQuestionDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Savol qo&apos;shish
                  </Button>
                </div>

                {data.questions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
                    Hali bironta savol yo&apos;q. "Savol qo&apos;shish" tugmasini bosing.
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {data.questions.map((q, idx) => (
                      <li key={q.id} className="rounded-xl border border-border/60 bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 pb-2">
                              <Badge variant="outline">#{idx + 1}</Badge>
                              <Badge variant="secondary">
                                {QUIZ_QUESTION_TYPE_LABELS_UZ[q.type]}
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm font-medium text-foreground">
                              {q.textUz}
                            </p>
                            {q.type === 'SINGLE_CHOICE' && q.options.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-xs">
                                {q.options.map((o) => (
                                  <li
                                    key={o.key}
                                    className={`flex items-center gap-2 ${o.isCorrect ? 'text-primary' : 'text-muted-foreground'}`}
                                  >
                                    {o.isCorrect ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                      <span className="inline-block h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                                    )}
                                    <span className="font-semibold">{o.key}.</span>
                                    <span>{o.textUz}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            {q.type === 'LIKERT_5' ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Shkala: 1 → mutlaqo qo&apos;shilmayman … 5 → to&apos;liq qo&apos;shilaman
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingQuestion(q);
                                setQuestionDialogOpen(true);
                              }}
                              aria-label="Tahrirlash"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setRemovingQuestion(q)}
                              aria-label="O'chirish"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {quizId ? (
        <QuestionFormDialog
          open={questionDialogOpen}
          onOpenChange={setQuestionDialogOpen}
          quizId={quizId}
          question={editingQuestion}
        />
      ) : null}

      <ConfirmDialog
        open={!!removingQuestion}
        onOpenChange={(v) => !v && setRemovingQuestion(null)}
        title={`Savolni o'chirasizmi?`}
        description={removingQuestion ? `"${removingQuestion.textUz.slice(0, 100)}…" o'chiriladi.` : undefined}
        confirmLabel="Ha, o'chirish"
        loading={removeQuestion.isPending}
        onConfirm={() => {
          if (!removingQuestion) return;
          removeQuestion.mutate(removingQuestion.id, {
            onSuccess: () => setRemovingQuestion(null),
          });
        }}
      />
    </>
  );
}
