'use client';

import {
  createQuizSchema,
  type CreateQuizInput,
  type QuizSummaryDto,
  type UpdateQuizInput,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

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
import type { ApiError } from '@/shared/lib/api-client';

import { useCreateQuiz, useUpdateQuiz } from '../hooks/use-quizzes';

interface QuizFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null yoki undefined bo'lsa — Ekologik monitoring bo'limidagi standalone test. */
  lessonId?: string | null;
  quiz?: QuizSummaryDto | null;
}

/** Yangi test yaratish yoki mavjud testning meta ma'lumotlarini tahrirlash. */
export function QuizFormDialog({ open, onOpenChange, lessonId, quiz }: QuizFormDialogProps) {
  const isEdit = !!quiz;
  const create = useCreateQuiz();
  const update = useUpdateQuiz();

  const form = useForm<CreateQuizInput>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: {
      lessonId: lessonId ?? null,
      titleUz: '',
      descriptionUz: '',
      passPercent: 60,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      lessonId: lessonId ?? null,
      titleUz: quiz?.titleUz ?? '',
      descriptionUz: quiz?.descriptionUz ?? '',
      passPercent: quiz?.passPercent ?? 60,
    });
  }, [open, quiz, lessonId, form]);

  async function onSubmit(values: CreateQuizInput) {
    try {
      if (isEdit && quiz) {
        const patch: UpdateQuizInput = {
          titleUz: values.titleUz,
          descriptionUz: values.descriptionUz,
          passPercent: values.passPercent,
        };
        await update.mutateAsync({ id: quiz.id, input: patch });
      } else {
        await create.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (err) {
      const apiError = err as ApiError;
      const field = Object.keys(apiError.fieldErrors ?? {})[0];
      if (field) {
        form.setError(field as keyof CreateQuizInput, {
          message: apiError.fieldErrors[field]?.[0],
        });
      } else {
        form.setError('root', { message: apiError.message });
      }
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Testni tahrirlash' : 'Yangi test'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titleUz">Sarlavha</Label>
            <Input
              id="titleUz"
              placeholder="Masalan: Mavzu bo'yicha diagnostik test"
              {...form.register('titleUz')}
            />
            {form.formState.errors.titleUz ? (
              <p className="text-xs text-destructive">{form.formState.errors.titleUz.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descriptionUz">Qisqa tavsif (ixtiyoriy)</Label>
            <textarea
              id="descriptionUz"
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Testning maqsadi, qoidalari va baholash tartibi"
              {...form.register('descriptionUz')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="passPercent">O'tish foizi (0–100)</Label>
            <Input
              id="passPercent"
              type="number"
              min={0}
              max={100}
              {...form.register('passPercent', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Baholanadigan savollar bo'yicha minimal muvaffaqiyat foizi.
            </p>
          </div>

          {form.formState.errors.root ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
