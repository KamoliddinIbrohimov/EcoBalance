'use client';

import type { ModuleDto } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { ApiError, apiClient } from '@/shared/lib/api-client';

interface Envelope<T> {
  data: T;
}

export function ModulesPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleDto | null>(null);
  const [removing, setRemoving] = useState<ModuleDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['modules', courseId],
    queryFn: async () => {
      const r = await apiClient.get<Envelope<ModuleDto[]>>(`/courses/${courseId}/modules`);
      return r.data.data;
    },
    enabled: !!courseId,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/modules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modules', courseId] });
      qc.invalidateQueries({ queryKey: ['lessons'] });
      setRemoving(null);
    },
  });

  const removeErr = removeMut.error as ApiError | undefined;

  return (
    <>
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Modullar / bo&apos;limlar
            </h2>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Yangi modul
          </Button>
        </div>

        {removeErr ? (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{removeErr.problem.title ?? 'Xatolik'}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Tavsif</TableHead>
                <TableHead className="w-24">Nashr</TableHead>
                <TableHead className="w-32 text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.length === 0 ? (
                <TableEmpty colSpan={5}>Modul yo&apos;q</TableEmpty>
              ) : (
                data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.orderIndex + 1}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{m.titleUz}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.descriptionUz ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.isPublished ? 'Nashr etilgan' : 'Qoralama'}
                    </TableCell>
                    <TableCell className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(m);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <ModuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        courseId={courseId}
        module={editing}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Modulni o'chirish"
        description={`"${removing?.titleUz}" modulini o'chirish — modul darslari moduleId=null bo'lib qoladi.`}
        loading={removeMut.isPending}
        onConfirm={() => removing && removeMut.mutate(removing.id)}
      />
    </>
  );
}

function ModuleFormDialog({
  open,
  onOpenChange,
  courseId,
  module,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  module: ModuleDto | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!module;
  const [titleUz, setTitleUz] = useState(module?.titleUz ?? '');
  const [descriptionUz, setDescriptionUz] = useState(module?.descriptionUz ?? '');
  const [isPublished, setIsPublished] = useState(module?.isPublished ?? true);

  // Reset on open
  if (open && module && titleUz !== module.titleUz && !isEdit) {
    // noop safeguard
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (isEdit && module) {
        await apiClient.patch(`/modules/${module.id}`, {
          titleUz: titleUz.trim(),
          descriptionUz: descriptionUz.trim() || null,
          isPublished,
        });
      } else {
        await apiClient.post('/modules', {
          courseId,
          titleUz: titleUz.trim(),
          descriptionUz: descriptionUz.trim() || null,
          isPublished,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modules', courseId] });
      onOpenChange(false);
      setTitleUz('');
      setDescriptionUz('');
      setIsPublished(true);
    },
  });

  const err = mut.error instanceof ApiError ? mut.error.problem.title ?? 'Xatolik' : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setTitleUz(module?.titleUz ?? '');
          setDescriptionUz(module?.descriptionUz ?? '');
          setIsPublished(module?.isPublished ?? true);
        } else if (module) {
          setTitleUz(module.titleUz);
          setDescriptionUz(module.descriptionUz ?? '');
          setIsPublished(module.isPublished);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modulni tahrirlash' : 'Yangi modul'}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
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
            <Label htmlFor="titleUz">Nom</Label>
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
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={descriptionUz}
              onChange={(e) => setDescriptionUz(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            Nashr etilgan
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={mut.isPending || !titleUz.trim()}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
