'use client';

import {
  createEcoReportSchema,
  ECO_REPORT_CATEGORY,
  ECO_REPORT_CATEGORY_LABELS_UZ,
  ECO_REPORT_RISK,
  ECO_REPORT_RISK_LABELS_UZ,
  type CreateEcoReportInput,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateEcoReport } from '@/features/eco-reports/hooks/use-eco-reports';
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
import { cn } from '@/shared/lib/cn';
import type { ApiError } from '@/shared/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-primary-soft text-primary border-primary/30',
  MEDIUM: 'bg-warning-soft text-warning border-warning/30',
  HIGH: 'bg-destructive/10 text-destructive border-destructive/30',
};

const RISK_EMOJI: Record<string, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🔴',
};

export function EcoReportFormDialog({ open, onOpenChange }: Props) {
  const create = useCreateEcoReport();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateEcoReportInput>({
    resolver: zodResolver(createEcoReportSchema),
    defaultValues: {
      category: ECO_REPORT_CATEGORY.WASTE,
      riskLevel: ECO_REPORT_RISK.MEDIUM,
      descriptionUz: '',
      suggestionUz: '',
      locationLabel: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      category: ECO_REPORT_CATEGORY.WASTE,
      riskLevel: ECO_REPORT_RISK.MEDIUM,
      descriptionUz: '',
      suggestionUz: '',
      locationLabel: '',
    });
  }, [open, reset]);

  const err = create.error as ApiError | undefined;

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      {
        ...values,
        suggestionUz: values.suggestionUz?.trim() || null,
        locationLabel: values.locationLabel?.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="eco-scroll max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Muammo haqida xabar berish</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Muammo turi</Label>
            <Select
              value={watch('category')}
              onValueChange={(v) =>
                setValue('category', v as CreateEcoReportInput['category'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ECO_REPORT_CATEGORY).map((c) => (
                  <SelectItem key={c} value={c}>
                    {ECO_REPORT_CATEGORY_LABELS_UZ[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Xavf darajasi</Label>
            <div className="flex gap-2">
              {Object.values(ECO_REPORT_RISK).map((r) => {
                const selected = watch('riskLevel') === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setValue('riskLevel', r)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                      selected
                        ? `${RISK_STYLES[r]} shadow-sm`
                        : 'border-border text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    <span>{RISK_EMOJI[r]}</span>
                    <span>{ECO_REPORT_RISK_LABELS_UZ[r]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="er-desc">Muammo tavsifi</Label>
            <textarea
              id="er-desc"
              rows={3}
              placeholder="Nima muammo? Qayerda va qanday holatda?"
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              {...register('descriptionUz')}
            />
            {errors.descriptionUz ? (
              <p className="text-xs font-medium text-destructive">
                {errors.descriptionUz.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="er-loc">Joylashuv (matn shaklida)</Label>
            <Input
              id="er-loc"
              placeholder="Masalan: Chirchiq shahri, 10-uy yonida"
              {...register('locationLabel')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="er-sug">Taklif (ixtiyoriy)</Label>
            <textarea
              id="er-sug"
              rows={2}
              placeholder="Bu muammoni qanday hal qilish mumkin?"
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              {...register('suggestionUz')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Yuborish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
