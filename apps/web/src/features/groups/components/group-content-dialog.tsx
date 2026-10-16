'use client';

import type { CourseDto, GroupWithTeacherDto, QuizSummaryDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { groupsApi } from '@/features/groups/api/groups-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { ApiError, apiClient } from '@/shared/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupWithTeacherDto;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

export function GroupContentDialog({ open, onOpenChange, group }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'courses' | 'quizzes'>('courses');
  const [courseId, setCourseId] = useState('');
  const [quizId, setQuizId] = useState('');

  const { data: boundCourses } = useQuery({
    queryKey: ['groups', group.id, 'courses'],
    queryFn: () => groupsApi.courseBindings(group.id),
    enabled: open,
  });
  const { data: boundQuizzes } = useQuery({
    queryKey: ['groups', group.id, 'quizzes'],
    queryFn: () => groupsApi.quizBindings(group.id),
    enabled: open,
  });
  const { data: allCourses } = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: async () => {
      const res = await apiClient.get<Paginated<CourseDto>>('/courses', {
        params: { perPage: 200 },
      });
      return res.data.data;
    },
    enabled: open,
  });
  const { data: allQuizzes } = useQuery({
    queryKey: ['quizzes', 'all'],
    queryFn: async () => {
      const res = await apiClient.get<Paginated<QuizSummaryDto>>('/quizzes', {
        params: { perPage: 200 },
      });
      return res.data.data;
    },
    enabled: open,
  });

  const bindCourseMut = useMutation({
    mutationFn: () => groupsApi.bindCourse(group.id, courseId),
    onSuccess: () => {
      setCourseId('');
      qc.invalidateQueries({ queryKey: ['groups', group.id, 'courses'] });
    },
  });
  const unbindCourseMut = useMutation({
    mutationFn: (cid: string) => groupsApi.unbindCourse(group.id, cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', group.id, 'courses'] }),
  });
  const bindQuizMut = useMutation({
    mutationFn: () => groupsApi.bindQuiz(group.id, quizId),
    onSuccess: () => {
      setQuizId('');
      qc.invalidateQueries({ queryKey: ['groups', group.id, 'quizzes'] });
    },
  });
  const unbindQuizMut = useMutation({
    mutationFn: (qid: string) => groupsApi.unbindQuiz(group.id, qid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', group.id, 'quizzes'] }),
  });

  const boundCourseIds = new Set((boundCourses ?? []).map((c) => c.courseId));
  const boundQuizIds = new Set((boundQuizzes ?? []).map((q) => q.quizId));
  const availableCourses = (allCourses ?? []).filter((c) => !boundCourseIds.has(c.id));
  const availableQuizzes = (allQuizzes ?? []).filter((q) => !boundQuizIds.has(q.id));

  const err =
    [bindCourseMut, unbindCourseMut, bindQuizMut, unbindQuizMut]
      .map((m) => (m.error instanceof ApiError ? m.error.problem.title : null))
      .find((e) => e) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kurs va testlar — {group.nameUz}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex gap-2 border-b border-border/60">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium ${tab === 'courses' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setTab('courses')}
          >
            Kurslar ({boundCourses?.length ?? 0})
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium ${tab === 'quizzes' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setTab('quizzes')}
          >
            Testlar ({boundQuizzes?.length ?? 0})
          </button>
        </div>

        {tab === 'courses' ? (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Kurs tanlang</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">— tanlang —</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameUz}{c.isPublished ? '' : ' (qoralama)'}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!courseId || bindCourseMut.isPending}
                onClick={() => bindCourseMut.mutate()}
              >
                {bindCourseMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Biriktirish
              </Button>
            </div>

            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {(boundCourses ?? []).length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  Kurs biriktirilmagan
                </li>
              ) : (
                (boundCourses ?? []).map((b) => (
                  <li key={b.courseId} className="flex items-center justify-between gap-2 p-3">
                    <div className="truncate text-sm">
                      {b.course.nameUz}
                      {!b.course.isPublished ? (
                        <span className="ml-2 text-xs text-muted-foreground">(qoralama)</span>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={unbindCourseMut.isPending}
                      onClick={() => unbindCourseMut.mutate(b.courseId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Test tanlang</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={quizId}
                  onChange={(e) => setQuizId(e.target.value)}
                >
                  <option value="">— tanlang —</option>
                  {availableQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.titleUz}{q.isPublished ? '' : ' (qoralama)'}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!quizId || bindQuizMut.isPending}
                onClick={() => bindQuizMut.mutate()}
              >
                {bindQuizMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Biriktirish
              </Button>
            </div>

            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {(boundQuizzes ?? []).length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  Test biriktirilmagan
                </li>
              ) : (
                (boundQuizzes ?? []).map((b) => (
                  <li key={b.quizId} className="flex items-center justify-between gap-2 p-3">
                    <div className="truncate text-sm">
                      {b.quiz.titleUz}
                      {!b.quiz.isPublished ? (
                        <span className="ml-2 text-xs text-muted-foreground">(qoralama)</span>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={unbindQuizMut.isPending}
                      onClick={() => unbindQuizMut.mutate(b.quizId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
