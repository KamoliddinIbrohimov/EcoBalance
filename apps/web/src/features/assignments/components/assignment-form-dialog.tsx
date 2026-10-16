'use client';

import type { AssignmentDto, GroupWithTeacherDto } from '@eco/shared';
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

  const [groupId, setGroupId] = useState<string>('');
  const [titleUz, setTitleUz] = useState('');
  const [descriptionUz, setDescriptionUz] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('100');

  const { data: groups } = useQuery<{ data: GroupWithTeacherDto[]; meta: { total: number } }>({
    queryKey: ['groups', 'list'],
    queryFn: () => groupsApi.list(),
    enabled: open && !isEdit,
  });

  useEffect(() => {
    if (open) {
      if (isEdit && assignment) {
        setGroupId(assignment.groupId);
        setTitleUz(assignment.titleUz);
        setDescriptionUz(assignment.descriptionUz ?? '');
        setDueAt(assignment.dueAt ? assignment.dueAt.slice(0, 16) : '');
        setMaxScore(String(assignment.maxScore));
      } else {
        setGroupId('');
        setTitleUz('');
        setDescriptionUz('');
        setDueAt('');
        setMaxScore('100');
      }
    }
  }, [open, isEdit, assignment]);

  const mut = useMutation({
    mutationFn: async () => {
      const score = Number(maxScore);
      const due = dueAt ? new Date(dueAt).toISOString() : null;
      if (isEdit && assignment) {
        return assignmentsApi.update(assignment.id, {
          titleUz: titleUz.trim(),
          descriptionUz: descriptionUz.trim() || null,
          dueAt: due as unknown as Date | null,
          maxScore: score,
        });
      }
      return assignmentsApi.create({
        groupId,
        titleUz: titleUz.trim(),
        descriptionUz: descriptionUz.trim() || null,
        dueAt: due as unknown as Date | null,
        maxScore: score,
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
              <Label htmlFor="maxScore">Maksimal ball</Label>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={mut.isPending || (!isEdit && !groupId) || !titleUz.trim()}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
