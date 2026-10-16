'use client';

import type { GroupWithTeacherDto } from '@eco/shared';
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

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupWithTeacherDto;
}

export function GroupMembersDialog({ open, onOpenChange, group }: Props) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['groups', group.id, 'members'],
    queryFn: () => groupsApi.members(group.id),
    enabled: open,
  });

  const { data: freeStudents } = useQuery({
    queryKey: ['users', 'students-free'],
    queryFn: async () => {
      // Hamma faol studentlar ro'yxati — guruhdagilarni filterda chiqaramiz
      const res = await apiClient.get<Paginated<Student>>('/users', {
        params: { role: 'STUDENT', perPage: 200, isActive: true },
      });
      return res.data.data;
    },
    enabled: open,
  });

  const addMut = useMutation({
    mutationFn: () => groupsApi.addMember(group.id, { studentId: selectedId }),
    onSuccess: () => {
      setSelectedId('');
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (studentId: string) => groupsApi.removeMember(group.id, studentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });

  const memberIds = new Set((members ?? []).map((m) => m.studentId));
  const addableStudents = (freeStudents ?? []).filter((s) => !memberIds.has(s.id));

  const err =
    addMut.error instanceof ApiError
      ? addMut.error.problem.title ?? 'Qo\'shib bo\'lmadi'
      : removeMut.error instanceof ApiError
        ? removeMut.error.problem.title ?? 'Chiqarib bo\'lmadi'
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guruh a&apos;zolari — {group.nameUz}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Yangi talaba</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">— tanlang —</option>
                {addableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.email})
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={!selectedId || addMut.isPending}
              onClick={() => addMut.mutate()}
            >
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Qo&apos;shish
            </Button>
          </div>

          <div className="rounded-lg border border-border/60">
            {isLoading ? (
              <div className="flex items-center justify-center p-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !members || members.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Hozircha a&apos;zolar yo&apos;q
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {members.map((m) => (
                  <li key={m.studentId} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {m.student.firstName} {m.student.lastName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.student.email}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={removeMut.isPending}
                      onClick={() => removeMut.mutate(m.studentId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
