'use client';

import type { AssignmentDto, AssignmentKind, GroupWithTeacherDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { assignmentsApi } from '@/features/assignments/api/assignments-api';
import { groupsApi } from '@/features/groups/api/groups-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ApiError } from '@/shared/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: AssignmentDto | null;
}

export function AssignmentFormDialog({ open, onOpenChange, assignment }: Props) {
  const qc = useQueryClient();
  const isEdit = !!assignment;

  const [groupId, setGroupId] = useState('');
  const [kind, setKind] = useState<AssignmentKind>('TASK');
  const [titleUz, setTitleUz] = useState('');
  const [descriptionUz, setDescriptionUz] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  // TASK
  const [allowLate, setAllowLate] = useState(false);
  const [latePenalty, setLatePenalty] = useState('0');
  // TIMED
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [timeLimit, setTimeLimit] = useState('30');

  const { data: groups } = useQuery<{ data: GroupWithTeacherDto[]; meta: { total: number } }>({
    queryKey: ['groups', 'list'],
    queryFn: () => groupsApi.list(),
    enabled: open && !isEdit,
  });

  useEffect(() => {
    if (open) {
      if (isEdit && assignment) {
        setGroupId(assignment.groupId);
        setKind(assignment.kind);
        setTitleUz(assignment.titleUz);
        setDescriptionUz(assignment.descriptionUz ?? '');
        setDueAt(assignment.dueAt ? assignment.dueAt.slice(0, 16) : '');
        setMaxScore(String(assignment.maxScore));
        setAllowLate(assignment.allowLate);
        setLatePenalty(String(assignment.latePenaltyPercent));
        setStartsAt(assignment.startsAt ? assignment.startsAt.slice(0, 16) : '');
        setEndsAt(assignment.endsAt ? assignment.endsAt.slice(0, 16) : '');
        setTimeLimit(String(assignment.timeLimitMinutes ?? 30));
      } else {
        setGroupId('');
        setKind('TASK');
        setTitleUz('');
        setDescriptionUz('');
        setDueAt('');
        setMaxScore('100');
        setAllowLate(false);
        setLatePenalty('0');
        setStartsAt('');
        setEndsAt('');
        setTimeLimit('30');
      }
    }
  }, [open, isEdit, assignment]);

  const mut = useMutation({
    mutationFn: async () => {
      const score = Number(maxScore);
      const due = dueAt ? new Date(dueAt).toISOString() : null;
      const starts = startsAt ? new Date(startsAt).toISOString() : null;
      const ends = endsAt ? new Date(endsAt).toISOString() : null;
      const limit = Number(timeLimit);
      const penalty = Number(latePenalty);
      if (isEdit && assignment) {
        return assignmentsApi.update(assignment.id, {
          titleUz: titleUz.trim(),
          descriptionUz: descriptionUz.trim() || null,
          dueAt: due as unknown as Date | null,
          maxScore: score,
          allowLate,
          latePenaltyPercent: penalty,
          startsAt: starts as unknown as Date | null,
          endsAt: ends as unknown as Date | null,
          timeLimitMinutes: kind === 'TIMED' ? limit : null,
        });
      }
      return assignmentsApi.create({
        groupId,
        kind,
        titleUz: titleUz.trim(),
        descriptionUz: descriptionUz.trim() || null,
        dueAt: due as unknown as Date | null,
        maxScore: score,
        allowLate,
        latePenaltyPercent: penalty,
        startsAt: starts as unknown as Date | null,
        endsAt: ends as unknown as Date | null,
        timeLimitMinutes: kind === 'TIMED' ? limit : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      onOpenChange(false);
    },
  });

  const rootError =
    mut.error instanceof ApiError ? mut.error.problem.title ?? 'Xatolik yuz berdi' : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Topshiriqni tahrirlash' : 'Yangi topshiriq'}</DialogTitle>
        </DialogHeader>

        {rootError ? (
          <Alert variant="destructive">
            <AlertDescription>{rootError}</AlertDescription>
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
          {!isEdit ? (
            <>
              <div>
                <Label htmlFor="groupId">Guruh</Label>
                <select
                  id="groupId"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  required
                >
                  <option value="">— tanlang —</option>
                  {(groups?.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameUz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="kind">Topshiriq turi</Label>
                <select
                  id="kind"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AssignmentKind)}
                >
                  <option value="TASK">Topshiriq (TASK) — fayl/matn javob</option>
                  <option value="TIMED">Taymerli (TIMED) — vaqt bilan oyna</option>
                  <option value="QUESTIONNAIRE">So‘rovnoma (QUESTIONNAIRE) — test</option>
                </select>
              </div>
            </>
          ) : null}

          <div>
            <Label htmlFor="titleUz">Sarlavha</Label>
            <Input
              id="titleUz"
              value={titleUz}
              onChange={(e) => setTitleUz(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="descriptionUz">Tavsif</Label>
            <textarea
              id="descriptionUz"
              rows={4}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={descriptionUz}
              onChange={(e) => setDescriptionUz(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dueAt">Muddat</Label>
              <Input
                id="dueAt"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="maxScore">Maks ball</Label>
              <Input
                id="maxScore"
                type="number"
                min={1}
                max={1000}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </div>
          </div>

          {kind === 'TASK' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                />
                Kechikishga ruxsat
              </label>
              <div>
                <Label htmlFor="penalty">Kechikish jarimasi (%)</Label>
                <Input
                  id="penalty"
                  type="number"
                  min={0}
                  max={100}
                  value={latePenalty}
                  onChange={(e) => setLatePenalty(e.target.value)}
                  disabled={!allowLate}
                />
              </div>
            </div>
          ) : null}

          {kind === 'TIMED' ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="startsAt">Boshlanish</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endsAt">Yopilish</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="timeLimit">Taymer (daq)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min={1}
                  max={480}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              disabled={mut.isPending || (!isEdit && !groupId) || !titleUz.trim()}
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
