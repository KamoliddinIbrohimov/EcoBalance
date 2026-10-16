'use client';

import { createGroupSchema, updateGroupSchema, type CreateGroupInput, type GroupWithTeacherDto, type UpdateGroupInput } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

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
import { ApiError, apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

interface TeacherOption {
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
  group?: GroupWithTeacherDto | null;
}

export function GroupFormDialog({ open, onOpenChange, group }: Props) {
  const qc = useQueryClient();
  const isSuperAdmin = useAuthStore((s) => s.user?.roles.includes('SUPER_ADMIN') ?? false);
  const isEdit = !!group;

  const schema = isEdit ? updateGroupSchema : createGroupSchema;
  const form = useForm<CreateGroupInput | UpdateGroupInput>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          nameUz: group?.nameUz ?? '',
          descriptionUz: group?.descriptionUz ?? '',
          isActive: group?.isActive ?? true,
        }
      : {
          nameUz: '',
          descriptionUz: '',
          teacherId: undefined,
        },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && group) {
        form.reset({
          nameUz: group.nameUz,
          descriptionUz: group.descriptionUz ?? '',
          isActive: group.isActive,
        });
      } else {
        form.reset({ nameUz: '', descriptionUz: '', teacherId: undefined });
      }
    }
  }, [open, isEdit, group, form]);

  // Faqat SUPER_ADMIN uchun: TEACHER ro'yxatini olib keladi
  const { data: teachers } = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: async () => {
      const res = await apiClient.get<Paginated<TeacherOption>>('/users', {
        params: { role: 'TEACHER', perPage: 100, isActive: true },
      });
      return res.data.data;
    },
    enabled: open && !isEdit && isSuperAdmin,
  });

  const mut = useMutation({
    mutationFn: async (values: CreateGroupInput | UpdateGroupInput) => {
      if (isEdit && group) {
        return groupsApi.update(group.id, values as UpdateGroupInput);
      }
      return groupsApi.create(values as CreateGroupInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      onOpenChange(false);
    },
  });

  const rootError =
    mut.error instanceof ApiError ? mut.error.problem.title ?? 'Xatolik yuz berdi' : null;

  const onSubmit = form.handleSubmit((values) => mut.mutate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Guruhni tahrirlash' : 'Yangi guruh'}</DialogTitle>
        </DialogHeader>

        {rootError ? (
          <Alert variant="destructive">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="nameUz">Nomi</Label>
            <Input id="nameUz" {...form.register('nameUz')} />
            {form.formState.errors.nameUz ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.nameUz.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="descriptionUz">Tavsif</Label>
            <textarea
              id="descriptionUz"
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              {...form.register('descriptionUz')}
            />
          </div>

          {!isEdit && isSuperAdmin ? (
            <div>
              <Label htmlFor="teacherId">O&apos;qituvchi</Label>
              <select
                id="teacherId"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('teacherId')}
                defaultValue=""
              >
                <option value="">— tanlang —</option>
                {(teachers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.email})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('isActive')} />
              Faol
            </label>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
