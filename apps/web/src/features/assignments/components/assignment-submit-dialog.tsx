'use client';

import type { AssignmentDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { assignmentsApi } from '@/features/assignments/api/assignments-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
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

  const { data: existing } = useQuery({
    queryKey: ['assignments', assignment.id, 'my-submission'],
    queryFn: () => assignmentsApi.mySubmission(assignment.id),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setText(existing?.textUz ?? '');
    }
  }, [open, existing]);

  const mut = useMutation({
    mutationFn: () => assignmentsApi.submit(assignment.id, { textUz: text.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      onOpenChange(false);
    },
  });

  const rootError =
    mut.error instanceof ApiError ? mut.error.problem.title ?? 'Topshirib bo\'lmadi' : null;

  const isGraded = existing?.status === 'GRADED' || existing?.status === 'RETURNED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{assignment.titleUz}</DialogTitle>
        </DialogHeader>

        {rootError ? (
          <Alert variant="destructive">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        ) : null}

        {existing?.status === 'GRADED' ? (
          <Alert>
            <AlertDescription>
              Baholandi: {existing.score}/{assignment.maxScore}
              {existing.feedbackUz ? ` — ${existing.feedbackUz}` : ''}
            </AlertDescription>
          </Alert>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <Label htmlFor="textUz">Javob matni</Label>
            <textarea
              id="textUz"
              rows={8}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isGraded}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Yopish
            </Button>
            <Button type="submit" disabled={mut.isPending || isGraded || !text.trim()}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {existing ? 'Qayta topshirish' : 'Topshirish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
