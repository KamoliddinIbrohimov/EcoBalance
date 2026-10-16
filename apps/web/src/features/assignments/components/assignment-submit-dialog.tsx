'use client';

import type { AssignmentDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FileUp, Loader2, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { assignmentsApi } from '@/features/assignments/api/assignments-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { ApiError } from '@/shared/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: AssignmentDto;
}

export function AssignmentSubmitDialog({ open, onOpenChange, assignment }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: existing } = useQuery({
    queryKey: ['assignments', assignment.id, 'my-submission'],
    queryFn: () => assignmentsApi.mySubmission(assignment.id),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setText(existing?.textUz ?? '');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open, existing]);

  const submitTextMut = useMutation({
    mutationFn: () => assignmentsApi.submit(assignment.id, { textUz: text.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      onOpenChange(false);
    },
  });

  const submitFileMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Fayl tanlanmagan');
      return assignmentsApi.submitFile(assignment.id, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      onOpenChange(false);
    },
  });

  const startMut = useMutation({
    mutationFn: () => assignmentsApi.startTimed(assignment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', assignment.id, 'my-submission'] });
    },
  });

  const rootErr =
    submitTextMut.error instanceof ApiError
      ? submitTextMut.error.problem.title ?? 'Topshirib bo‘lmadi'
      : submitFileMut.error instanceof ApiError
        ? submitFileMut.error.problem.title ?? 'Fayl yuklanmadi'
        : startMut.error instanceof ApiError
          ? startMut.error.problem.title ?? 'Urinishni boshlab bo‘lmadi'
          : null;

  const isGraded = existing?.status === 'GRADED';
  const isReturned = existing?.status === 'RETURNED';
  const isTimed = assignment.kind === 'TIMED';
  const now = Date.now();
  const deadline = existing?.attemptDeadline ? new Date(existing.attemptDeadline).getTime() : null;
  const activeTimed = isTimed && deadline && deadline > now;
  const needsStart = isTimed && (!existing || !deadline || deadline < now) && !isGraded;

  // Timer tick
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!activeTimed || !deadline) {
      setRemainingMs(null);
      return;
    }
    setRemainingMs(deadline - Date.now());
    const t = setInterval(() => setRemainingMs(deadline - Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeTimed, deadline]);

  const formatRemaining = (ms: number): string => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{assignment.titleUz}</DialogTitle>
        </DialogHeader>

        {rootErr ? (
          <Alert variant="destructive">
            <AlertDescription>{rootErr}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{assignment.kind}</Badge>
          {existing?.isLate ? <Badge variant="destructive">Kechikkan</Badge> : null}
          {isGraded ? (
            <Badge>Baholandi: {existing?.score}/{assignment.maxScore}</Badge>
          ) : isReturned ? (
            <Badge variant="secondary">Qaytarilgan — qayta topshiring</Badge>
          ) : null}
          {activeTimed && remainingMs !== null ? (
            <Badge className="font-mono">
              <Clock className="h-3 w-3" />
              {formatRemaining(remainingMs)}
            </Badge>
          ) : null}
        </div>

        {isGraded && existing?.feedbackUz ? (
          <Alert>
            <AlertDescription>
              <span className="font-semibold">Izoh:</span> {existing.feedbackUz}
            </AlertDescription>
          </Alert>
        ) : null}

        {needsStart ? (
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
            <p className="text-sm text-foreground">
              Taymerli topshiriq: {assignment.timeLimitMinutes} daqiqa. Boshlash tugmasini
              bosganingizda vaqt sanashi boshlanadi.
            </p>
            <Button
              className="mt-3"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
            >
              {startMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Boshlash
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="textUz">Javob matni</Label>
              <textarea
                id="textUz"
                rows={6}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isGraded}
              />
            </div>

            <div>
              <Label htmlFor="file">Fayl (ixtiyoriy, max 10 MB)</Label>
              <input
                ref={fileRef}
                id="file"
                type="file"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={isGraded}
              />
              {file ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Tanlangan: {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              ) : existing?.fileName ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Mavjud: {existing.fileName}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
          {!needsStart ? (
            <>
              {file ? (
                <Button
                  onClick={() => submitFileMut.mutate()}
                  disabled={submitFileMut.isPending || isGraded}
                >
                  {submitFileMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  Fayl bilan topshirish
                </Button>
              ) : null}
              <Button
                onClick={() => submitTextMut.mutate()}
                disabled={submitTextMut.isPending || isGraded || !text.trim()}
              >
                {submitTextMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isReturned ? 'Qayta topshirish' : existing ? 'Yangilash' : 'Topshirish'}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
