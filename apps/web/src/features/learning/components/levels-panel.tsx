'use client';

import { PERMISSION, type EducationLevelItemDto } from '@eco/shared';
import { Layers, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { LevelFormDialog } from '@/features/learning/components/level-form-dialog';
import {
  useEducationLevels,
  useRemoveEducationLevel,
} from '@/features/learning/hooks/use-education-levels';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { ApiError } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

export function LevelsPanel() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission(PERMISSION.COURSES_CREATE);
  const canUpdate = hasPermission(PERMISSION.COURSES_UPDATE);
  const canDelete = hasPermission(PERMISSION.COURSES_DELETE);

  const { data, isLoading } = useEducationLevels();
  const remove = useRemoveEducationLevel();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EducationLevelItemDto | null>(null);
  const [removing, setRemoving] = useState<EducationLevelItemDto | null>(null);

  const removeErr = remove.error as ApiError | undefined;

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ta&apos;lim darajalari (sidebar bo&apos;limlari)
          </h2>
        </div>
        {canCreate ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Yangi daraja
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">Yuklanmoqda…</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Ikon</TableHead>
              <TableHead>Turi</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data || data.length === 0 ? (
              <TableEmpty colSpan={6}>Ta&apos;lim darajalari yo&apos;q</TableEmpty>
            ) : (
              data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.orderIndex}</TableCell>
                  <TableCell className="font-medium">{l.nameUz}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">/{l.slug}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.iconName}</TableCell>
                  <TableCell>
                    {l.isBuiltIn ? (
                      <Badge variant="secondary">
                        <Lock className="mr-1 h-3 w-3" /> Asosiy
                      </Badge>
                    ) : (
                      <Badge variant="outline">Qo&apos;shimcha</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {canUpdate ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(l);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRemoving(l)}
                          title="O'chirish"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <LevelFormDialog open={formOpen} onOpenChange={setFormOpen} level={editing} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`"${removing?.nameUz ?? ''}" darajasini o'chirasizmi?`}
        description={
          removeErr?.message ??
          "Amal qaytarilmaydi. Ushbu daraja sidebar'dan yo'qoladi va /learning/level/<slug> sahifasi 404 qaytaradi. Kurslarga tegilmaydi — ular darajasiz qoladi."
        }
        confirmLabel={removing?.isBuiltIn ? "Baribir o'chirish" : "Ha, o'chirish"}
        loading={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </Card>
  );
}
