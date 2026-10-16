'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { ApiError, apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

interface Progress {
  id: string;
  studentId: string;
  lessonId: string;
  completedAt: string | null;
  lastViewedAt: string;
}

interface Envelope<T> {
  data: T;
}

export function LessonCompleteButton({ lessonId }: { lessonId: string }) {
  const qc = useQueryClient();
  const isStudent = useAuthStore(
    (s) =>
      s.user?.roles.includes('STUDENT') &&
      !s.user?.roles.includes('TEACHER') &&
      !s.user?.roles.includes('SUPER_ADMIN'),
  );

  // F5 (2.C) heartbeat — tab faol vaqtda har 30s'da serverga yuborish.
  // visibilitychange da to'xtaydi; server tomondan 60s cap bor.
  const activeRef = useRef<number>(0);
  const lastSentRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!isStudent) return;
    let visible = typeof document !== 'undefined' && !document.hidden;
    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);
    const tick = setInterval(() => {
      if (visible) activeRef.current += 1;
    }, 1000);
    const flush = setInterval(() => {
      const seconds = activeRef.current;
      activeRef.current = 0;
      lastSentRef.current = Date.now();
      if (seconds > 0) {
        apiClient
          .post(`/lessons/${lessonId}/heartbeat`, { activeSeconds: seconds })
          .catch(() => {
            /* ignore transient */
          });
      }
    }, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(tick);
      clearInterval(flush);
    };
  }, [isStudent, lessonId]);

  const { data: progressRows } = useQuery({
    queryKey: ['lessons', 'progress', 'me'],
    queryFn: async () => {
      const r = await apiClient.get<Envelope<Progress[]>>('/lessons/progress/me');
      return r.data.data ?? [];
    },
    enabled: !!isStudent,
  });

  const current = progressRows?.find((p) => p.lessonId === lessonId) ?? null;
  const isCompleted = !!current?.completedAt;

  const mut = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/lessons/${lessonId}/progress`, { completed: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lessons', 'progress', 'me'] });
      qc.invalidateQueries({ queryKey: ['stats', 'me'] });
    },
  });

  if (!isStudent) return null;

  if (isCompleted) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertDescription>Darsni tugatdingiz. Natijalaringiz statistikada aks etadi.</AlertDescription>
      </Alert>
    );
  }

  const errorMessage =
    mut.error instanceof ApiError ? mut.error.problem.title ?? 'Xatolik yuz berdi' : null;

  return (
    <div className="space-y-2">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Darsni tugatdim
      </Button>
    </div>
  );
}
