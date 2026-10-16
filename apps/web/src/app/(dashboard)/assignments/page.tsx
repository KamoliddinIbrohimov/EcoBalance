'use client';

import type { AssignmentDto, AssignmentSubmissionDto } from '@eco/shared';
import { PERMISSION } from '@eco/shared';
import {
  ClipboardList,
  Clock,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { assignmentsApi } from '@/features/assignments/api/assignments-api';
import { AssignmentFormDialog } from '@/features/assignments/components/assignment-form-dialog';
import { AssignmentGradeDialog } from '@/features/assignments/components/assignment-grade-dialog';
import { AssignmentSubmitDialog } from '@/features/assignments/components/assignment-submit-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { formatDateTime } from '@/shared/lib/format-date';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission(PERMISSION.ASSIGNMENTS_MANAGE));
  const canSubmit = useAuthStore((s) => s.hasPermission(PERMISSION.ASSIGNMENTS_SUBMIT));
  const isTeacherOrSA =
    user?.roles?.some((r) => r === 'SUPER_ADMIN' || r === 'TEACHER') ?? false;

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignmentDto | null>(null);
  const [submitTarget, setSubmitTarget] = useState<AssignmentDto | null>(null);
  const [gradeTarget, setGradeTarget] = useState<AssignmentDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', 'list'],
    queryFn: () => assignmentsApi.list(),
  });

  // U3: STUDENT uchun har topshiriqning my-submission statusini olib keltiramiz
  const mySubsQueries = useQueries({
    queries: (data?.data ?? []).map((a) => ({
      queryKey: ['assignments', a.id, 'my-submission'],
      queryFn: () => assignmentsApi.mySubmission(a.id),
      enabled: !isTeacherOrSA,
    })),
  });
  const mySubByAssignment = new Map<string, AssignmentSubmissionDto | null>();
  if (data?.data) {
    data.data.forEach((a, i) => {
      mySubByAssignment.set(a.id, mySubsQueries[i]?.data ?? null);
    });
  }

  function statusBadge(a: AssignmentDto) {
    const sub = mySubByAssignment.get(a.id);
    const now = Date.now();
    const dueMs = a.dueAt ? new Date(a.dueAt).getTime() : null;
    const overdue = dueMs !== null && dueMs < now && (!sub || sub.status === 'RETURNED');
    if (!sub && overdue) {
      return <Badge variant="destructive">Muddati o&apos;tgan</Badge>;
    }
    if (!sub) return <Badge variant="outline">Topshirilmagan</Badge>;
    if (sub.status === 'GRADED')
      return (
        <Badge>
          Baholandi: {sub.score}/{a.maxScore}
        </Badge>
      );
    if (sub.status === 'RETURNED') return <Badge variant="secondary">Qaytarilgan</Badge>;
    if (sub.isLate) return <Badge variant="destructive">Kechikkan</Badge>;
    return <Badge variant="secondary">Topshirilgan</Badge>;
  }

  function remainingTimeBadge(a: AssignmentDto) {
    const dueAt = a.endsAt ?? a.dueAt;
    if (!dueAt) return null;
    const diffMs = new Date(dueAt).getTime() - Date.now();
    if (diffMs <= 0) return null;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return <Badge variant="outline"><Clock className="h-3 w-3" />{mins} daq</Badge>;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return <Badge variant="outline"><Clock className="h-3 w-3" />{hours} s</Badge>;
    const days = Math.floor(hours / 24);
    return <Badge variant="outline"><Clock className="h-3 w-3" />{days} kun</Badge>;
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Topshiriqlar</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isTeacherOrSA
                ? "O'qituvchi — o'z guruhlariga topshiriq yaratish va baholash."
                : 'Siz uchun berilgan topshiriqlar ro\'yxati.'}
            </p>
          </div>
        </div>
        {canManage ? (
          <Button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Yangi topshiriq
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hozircha topshiriqlar yo&apos;q.
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((a) => (
            <li key={a.id}>
              <Card className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {a.titleUz}
                  </h2>
                  {a.descriptionUz ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {a.descriptionUz}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline">{a.kind}</Badge>
                    {!isTeacherOrSA ? statusBadge(a) : null}
                    {!isTeacherOrSA ? remainingTimeBadge(a) : null}
                    {a.dueAt ? (
                      <Badge variant="outline">
                        Muddat: {formatDateTime(new Date(a.dueAt))}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Muddat belgilanmagan</Badge>
                    )}
                    <Badge variant="secondary">Maks ball: {a.maxScore}</Badge>
                    {isTeacherOrSA ? (
                      <Badge variant="secondary">{a.submissionCount} topshirgan</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {canSubmit && !isTeacherOrSA && mySubByAssignment.get(a.id)?.status !== 'GRADED' ? (
                    <Button size="sm" onClick={() => setSubmitTarget(a)}>
                      <Send className="h-4 w-4" />
                      {mySubByAssignment.get(a.id) ? 'Yangilash' : 'Topshirish'}
                    </Button>
                  ) : null}
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setGradeTarget(a)}
                      >
                        <GraduationCap className="h-4 w-4" />
                        Baholash
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditTarget(a);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AssignmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        assignment={editTarget}
      />

      {submitTarget ? (
        <AssignmentSubmitDialog
          open={!!submitTarget}
          onOpenChange={(v) => !v && setSubmitTarget(null)}
          assignment={submitTarget}
        />
      ) : null}

      {gradeTarget ? (
        <AssignmentGradeDialog
          open={!!gradeTarget}
          onOpenChange={(v) => !v && setGradeTarget(null)}
          assignment={gradeTarget}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Topshiriqni o'chirish"
        description={`"${deleteTarget?.titleUz}" topshirig'i va barcha topshirilgan javoblar o'chadi.`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
      />
    </div>
  );
}
