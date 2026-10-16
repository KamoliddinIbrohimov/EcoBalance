'use client';

import type { GroupWithTeacherDto, LessonDto, ModuleDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, Lock, Trash2, Unlock } from 'lucide-react';
import { useState } from 'react';

import { groupsApi } from '@/features/groups/api/groups-api';
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
import { ApiError, apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupWithTeacherDto;
}

export function GroupReleaseDialog({ open, onOpenChange, group }: Props) {
  const qc = useQueryClient();
  const [targetKind, setTargetKind] = useState<'lesson' | 'module'>('module');
  const [targetId, setTargetId] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [status, setStatus] = useState<'LOCKED' | 'SCHEDULED' | 'OPEN'>('OPEN');

  const { data: bindings } = useQuery({
    queryKey: ['groups', group.id, 'courses'],
    queryFn: () => groupsApi.courseBindings(group.id),
    enabled: open,
  });

  // Barcha biriktirilgan kurslar modullari va darslari
  const { data: modulesByCourse } = useQuery({
    queryKey: ['groups', group.id, 'course-modules'],
    queryFn: async () => {
      const res: Array<{ courseName: string; modules: ModuleDto[]; lessons: LessonDto[] }> = [];
      for (const b of bindings ?? []) {
        const [mods, lessons] = await Promise.all([
          apiClient
            .get<Envelope<ModuleDto[]>>(`/courses/${b.courseId}/modules`)
            .then((r) => r.data.data),
          apiClient
            .get<Envelope<LessonDto[]>>(`/courses/${b.courseId}/lessons`)
            .then((r) => r.data.data),
        ]);
        res.push({ courseName: b.course.nameUz, modules: mods, lessons });
      }
      return res;
    },
    enabled: open && (bindings?.length ?? 0) > 0,
  });

  const { data: releases } = useQuery({
    queryKey: ['groups', group.id, 'releases'],
    queryFn: () => groupsApi.listReleases(group.id),
    enabled: open,
  });

  const upsertMut = useMutation({
    mutationFn: () =>
      groupsApi.upsertRelease(group.id, {
        [targetKind + 'Id']: targetId,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        status,
      }),
    onSuccess: () => {
      setTargetId('');
      setOpensAt('');
      qc.invalidateQueries({ queryKey: ['groups', group.id, 'releases'] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => groupsApi.removeRelease(group.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', group.id, 'releases'] }),
  });

  const err =
    upsertMut.error instanceof ApiError
      ? upsertMut.error.problem.title ?? 'Xatolik'
      : removeMut.error instanceof ApiError
        ? removeMut.error.problem.title ?? 'Xatolik'
        : null;

  const allModules = (modulesByCourse ?? []).flatMap((c) =>
    c.modules.map((m) => ({ id: m.id, label: `${c.courseName} › ${m.titleUz}` })),
  );
  const allLessons = (modulesByCourse ?? []).flatMap((c) =>
    c.lessons.map((l) => ({ id: l.id, label: `${c.courseName} › ${l.titleUz}` })),
  );
  const options = targetKind === 'module' ? allModules : allLessons;

  const statusBadge = (s: 'LOCKED' | 'SCHEDULED' | 'OPEN') => {
    const map: Record<typeof s, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      OPEN: { label: 'Ochiq', variant: 'default' },
      SCHEDULED: { label: 'Rejalashtirilgan', variant: 'secondary' },
      LOCKED: { label: 'Yopiq', variant: 'outline' },
    };
    return <Badge variant={map[s].variant}>{map[s].label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ochilish rejasi — {group.nameUz}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
            <div className="grid grid-cols-5 gap-2">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={targetKind}
                onChange={(e) => {
                  setTargetKind(e.target.value as 'lesson' | 'module');
                  setTargetId('');
                }}
              >
                <option value="module">Modul</option>
                <option value="lesson">Dars</option>
              </select>
              <select
                className="col-span-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="">— tanlang —</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                placeholder="opensAt"
              />
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="OPEN">Ochiq</option>
                <option value="SCHEDULED">Rejalashtirilgan</option>
                <option value="LOCKED">Yopiq</option>
              </select>
            </div>
            <Button
              className="mt-2"
              onClick={() => upsertMut.mutate()}
              disabled={!targetId || upsertMut.isPending}
            >
              {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Saqlash
            </Button>
          </div>

          <div className="rounded-lg border border-border/60">
            {!releases || releases.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Reja yo‘q — darslar default ochiq
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {releases.map((r) => {
                  const label =
                    r.moduleId
                      ? allModules.find((m) => m.id === r.moduleId)?.label ?? '— modul —'
                      : allLessons.find((l) => l.id === r.lessonId)?.label ?? '— dars —';
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">{label}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {r.opensAt ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(r.opensAt).toLocaleString('ru-RU')}
                            </span>
                          ) : (
                            <span>sana belgilanmagan</span>
                          )}
                          {statusBadge(r.status)}
                          {r.status === 'OPEN' ? (
                            <Unlock className="h-3 w-3 text-primary" />
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={removeMut.isPending}
                        onClick={() => removeMut.mutate(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
