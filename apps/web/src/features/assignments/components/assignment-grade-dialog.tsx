'use client';

import type { AssignmentDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { assignmentsApi } from '@/features/assignments/api/assignments-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ApiError } from '@/shared/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: AssignmentDto;
}

export function AssignmentGradeDialog({ open, onOpenChange, assignment }: Props) {
  const qc = useQueryClient();
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['assignments', assignment.id, 'submissions'],
    queryFn: () => assignmentsApi.submissions(assignment.id),
    enabled: open,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const mut = useMutation({
    mutationFn: ({ id, score, feedback }: { id: string; score: number; feedback: string }) =>
      assignmentsApi.grade(id, { score, feedbackUz: feedback, status: 'GRADED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', assignment.id, 'submissions'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setEditingId(null);
      setScore('');
      setFeedback('');
    },
  });

  const err = mut.error instanceof ApiError ? mut.error.problem.title ?? 'Xatolik' : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Baholash — {assignment.titleUz}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !submissions || submissions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Hali hech kim topshirmagan.
          </div>
        ) : (
          <ul className="space-y-3">
            {submissions.map((s) => (
              <li key={s.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {s.student.firstName} {s.student.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.student.email}</div>
                  </div>
                  <Badge variant={s.status === 'GRADED' ? 'default' : 'secondary'}>
                    {s.status === 'GRADED'
                      ? `Baho: ${s.score}/${assignment.maxScore}`
                      : s.status === 'RETURNED'
                        ? 'Qaytarilgan'
                        : 'Baholanmagan'}
                  </Badge>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {s.textUz || <span className="text-muted-foreground">— matn yo&apos;q —</span>}
                </p>

                {editingId === s.id ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`score-${s.id}`}>Ball (0..{assignment.maxScore})</Label>
                      <Input
                        id={`score-${s.id}`}
                        type="number"
                        min={0}
                        max={assignment.maxScore}
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`fb-${s.id}`}>Izoh</Label>
                      <Input
                        id={`fb-${s.id}`}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          mut.mutate({
                            id: s.id,
                            score: Number(score),
                            feedback: feedback.trim(),
                          })
                        }
                        disabled={mut.isPending || !score}
                      >
                        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Saqlash
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Bekor
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(s.id);
                        setScore(String(s.score ?? ''));
                        setFeedback(s.feedbackUz ?? '');
                      }}
                    >
                      {s.status === 'GRADED' ? 'Qayta baholash' : 'Baholash'}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
