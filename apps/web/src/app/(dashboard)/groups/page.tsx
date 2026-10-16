'use client';

import type { GroupWithTeacherDto } from '@eco/shared';
import { PERMISSION } from '@eco/shared';
import { BookOpen, CalendarClock, Loader2, Pencil, Plus, Trash2, Users, UsersRound } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { groupsApi } from '@/features/groups/api/groups-api';
import { GroupContentDialog } from '@/features/groups/components/group-content-dialog';
import { GroupFormDialog } from '@/features/groups/components/group-form-dialog';
import { GroupMembersDialog } from '@/features/groups/components/group-members-dialog';
import { GroupReleaseDialog } from '@/features/groups/components/group-release-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function GroupsPage() {
  const qc = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission(PERMISSION.GROUPS_MANAGE));

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupWithTeacherDto | null>(null);
  const [membersTarget, setMembersTarget] = useState<GroupWithTeacherDto | null>(null);
  const [contentTarget, setContentTarget] = useState<GroupWithTeacherDto | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<GroupWithTeacherDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupWithTeacherDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => groupsApi.list(),
    enabled: canManage,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      setDeleteTarget(null);
    },
  });

  if (!canManage) {
    return <UnderDevelopment description="Guruhlar bo'limiga kirish uchun ruxsat yo'q." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Guruhlar</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              O&apos;qituvchi o&apos;ziga tegishli, Super Admin barcha guruhlarni ko&apos;radi.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi guruh
        </Button>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hozircha guruhlar yo&apos;q. &quot;Yangi guruh&quot; tugmasini bosing.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.data.map((g) => (
            <li key={g.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-foreground">
                      {g.nameUz}
                    </h2>
                    {g.descriptionUz ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {g.descriptionUz}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={g.isActive ? 'default' : 'outline'}>
                    {g.isActive ? 'Faol' : 'Nofaol'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    O&apos;qituvchi:{' '}
                    <span className="font-medium text-foreground">
                      {g.teacher.firstName} {g.teacher.lastName}
                    </span>
                  </span>
                  <Badge variant="secondary">{g.memberCount} talaba</Badge>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMembersTarget(g)}
                  >
                    <UsersRound className="h-4 w-4" />
                    Talabalar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setContentTarget(g)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Mazmuni
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReleaseTarget(g)}
                  >
                    <CalendarClock className="h-4 w-4" />
                    Rejalashtirish
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditTarget(g);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(g)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <GroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editTarget}
      />

      {membersTarget ? (
        <GroupMembersDialog
          open={!!membersTarget}
          onOpenChange={(v) => !v && setMembersTarget(null)}
          group={membersTarget}
        />
      ) : null}

      {contentTarget ? (
        <GroupContentDialog
          open={!!contentTarget}
          onOpenChange={(v) => !v && setContentTarget(null)}
          group={contentTarget}
        />
      ) : null}

      {releaseTarget ? (
        <GroupReleaseDialog
          open={!!releaseTarget}
          onOpenChange={(v) => !v && setReleaseTarget(null)}
          group={releaseTarget}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Guruhni o'chirish"
        description={`"${deleteTarget?.nameUz}" guruhi va uning barcha a'zolari bog'lami o'chadi. Davom etasizmi?`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
      />
    </div>
  );
}
