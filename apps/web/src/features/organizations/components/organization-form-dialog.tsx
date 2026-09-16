'use client';

import {
  createOrganizationSchema,
  ORGANIZATION_TYPE,
  ORGANIZATION_TYPE_LABELS_UZ,
  type AdminOrganizationDto,
  type CreateOrganizationInput,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import type { ApiError } from '@/shared/lib/api-client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import {
  flattenTree,
  useCreateOrganization,
  useOrganizationsTree,
  useUpdateOrganization,
} from '../hooks/use-organizations';

const NO_PARENT = '__none__';

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: AdminOrganizationDto | null;
}

export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
}: OrganizationFormDialogProps) {
  const isEdit = !!organization;
  const { data: tree } = useOrganizationsTree();
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const pending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      nameUz: '',
      code: '',
      type: ORGANIZATION_TYPE.MAHALLA,
      parentId: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      nameUz: organization?.nameUz ?? '',
      code: organization?.code ?? '',
      type: organization?.type ?? ORGANIZATION_TYPE.MAHALLA,
      parentId: organization?.parentId ?? null,
    });
  }, [open, organization, reset]);

  const flatOptions = tree
    ? flattenTree(tree).filter((opt) => opt.id !== organization?.id)
    : [];

  const mutationError = (create.error ?? update.error) as ApiError | undefined;

  const onSubmit = handleSubmit((values) => {
    const payload: CreateOrganizationInput = {
      ...values,
      parentId: values.parentId || null,
    };

    if (isEdit && organization) {
      update.mutate(
        { id: organization.id, input: payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Tashkilotni tahrirlash' : "Yangi tashkilot qo'shish"}</DialogTitle>
        </DialogHeader>

        {mutationError ? (
          <Alert variant="destructive">
            <AlertDescription>{mutationError.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Nomi</Label>
            <Input id="org-name" placeholder="Masalan: Kimyogar mahallasi" {...register('nameUz')} />
            {errors.nameUz ? (
              <p className="text-xs font-medium text-destructive">{errors.nameUz.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-code">Kod</Label>
            <Input id="org-code" placeholder="masalan: kimyogar-mahallasi" {...register('code')} />
            <p className="text-xs text-muted-foreground">
              Faqat kichik lotin harflari, raqam va tire (-). Tizim ichida noyob identifikator.
            </p>
            {errors.code ? (
              <p className="text-xs font-medium text-destructive">{errors.code.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Turi</Label>
            <Select
              value={watch('type')}
              onValueChange={(v) => setValue('type', v as CreateOrganizationInput['type'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ORGANIZATION_TYPE).map((type) => (
                  <SelectItem key={type} value={type}>
                    {ORGANIZATION_TYPE_LABELS_UZ[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ota tashkilot (ixtiyoriy)</Label>
            <Select
              value={watch('parentId') || NO_PARENT}
              onValueChange={(v) =>
                setValue('parentId', v === NO_PARENT ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>— Yo'q (yuqori daraja) —</SelectItem>
                {flatOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {'—'.repeat(opt.depth)} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
