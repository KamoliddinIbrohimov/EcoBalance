'use client';

import type { AssignmentDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, RotateCcw } from 'lucide-react';
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
import { ApiError, apiClient } from '@/shared/lib/api-client';

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
  // U2: accommodation inputs
  const [accStudentId, setAccStudentId] = useState<string | null>(null);
  const [extraMinutes, setExtraMinutes] = useState('');
  const [newDueAt, setNewDueAt] = useState('');

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

  const reopenMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.reopen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', assignment.id, 'submissions'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  const accMut = useMutation({
    mutationFn: () => {
      if (!accStudentId) throw new Error('no student');
      return apiClient.post(
        `/assignments/${assignment.id}/accommodations/${accStudentId}`,
        {
          extraMinutes: extraMinutes ? Number(extraMinutes) : undefined,
          newDueAt: newDueAt ? new Date(newDueAt).toISOString() : undefined,
        },
      );
    },
    onSuccess: () => {
      setAccStudentId(null);
      setExtraMinutes('');
      setNewDueAt('');
      qc.invalidateQueries({ queryKey: ['assignments', assignment.id, 'submissions'] });
    },
  });

  const err =
    mut.error instanceof ApiError
      ? mut.error.problem.title ?? 'Xatolik'
      : reopenMut.error instanceof ApiError
        ? reopenMut.error.problem.title ?? 'Qayta ochib bo‘lmadi'
        : accMut.error instanceof ApiError
          ? accMut.error.problem.title ?? 'Accommodation xatosi'
          : null;

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
                  <div className="flex items-center gap-1">
                    {s.isLate ? <Badge variant="destructive">Kechikkan</Badge> : null}
                    <Badge variant={s.status === 'GRADED' ? 'default' : 'secondary'}>
                      {s.status === 'GRADED'
                        ? `Baho: ${s.score}/${assignment.maxScore}`
                        : s.status === 'RETURNED'
                          ? 'Qaytarilgan'
                          : 'Baholanmagan'}
                    </Badge>
                  </div>
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
                ) : accStudentId === s.studentId ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-secondary/30 p-2">
                    <div>
                      <Label htmlFor={`extra-${s.id}`} className="text-xs">+ daqiqa</Label>
                      <Input
                        id={`extra-${s.id}`}
                        type="number"
                        min={1}
                        value={extraMinutes}
                        onChange={(e) => setExtraMinutes(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`due-${s.id}`} className="text-xs">Yangi muddat</Label>
                      <Input
                        id={`due-${s.id}`}
                        type="datetime-local"
                        value={newDueAt}
                        onChange={(e) => setNewDueAt(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => accMut.mutate()}
                        disabled={accMut.isPending || (!extraMinutes && !newDueAt)}
                      >
                        {accMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Uzaytirish
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAccStudentId(null)}>
                        Bekor
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
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
                    {s.status === 'GRADED' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reopenMut.mutate(s.id)}
                        disabled={reopenMut.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Qaytarish
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAccStudentId(s.studentId);
                        setExtraMinutes('');
                        setNewDueAt('');
                      }}
                    >
                      <Clock className="h-4 w-4" />
                      Vaqt uzaytirish
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
