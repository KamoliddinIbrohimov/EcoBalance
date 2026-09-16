'use client';

import { createNewsSchema, type CreateNewsInput, type NewsDto } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateNews, useUpdateNews } from '@/features/news/hooks/use-news';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
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
import { cn } from '@/shared/lib/cn';

const ACCEPT = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp';
const MAX = 20 * 1024 * 1024;

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface NewsFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  news?: NewsDto | null;
}

export function NewsFormDialog({ open, onOpenChange, news }: NewsFormDialogProps) {
  const isEdit = !!news;
  const create = useCreateNews();
  const update = useUpdateNews();
  const pending = create.isPending || update.isPending;
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateNewsInput>({
    resolver: zodResolver(createNewsSchema),
    defaultValues: { titleUz: '', bodyUz: '', isPublished: false },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      titleUz: news?.titleUz ?? '',
      bodyUz: news?.bodyUz ?? '',
      isPublished: news?.isPublished ?? false,
    });
    setFile(null);
    setFileError(null);
    setRemoveAttachment(false);
  }, [open, news, reset]);

  function pickFile(f: File) {
    setFileError(null);
    if (f.size > MAX) {
      setFileError(`Fayl juda katta (${fmtSize(f.size)}). Maks: 20 MB.`);
      return;
    }
    setFile(f);
    setRemoveAttachment(false);
  }

  const err = (create.error ?? update.error) as ApiError | undefined;

  const onSubmit = handleSubmit((values) => {
    if (isEdit && news) {
      update.mutate(
        {
          id: news.id,
          input: {
            titleUz: values.titleUz,
            bodyUz: values.bodyUz,
            isPublished: values.isPublished,
            removeAttachment: removeAttachment && !file,
          },
          file,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate({ input: values, file }, { onSuccess: () => onOpenChange(false) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="eco-scroll max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Yangilikni tahrirlash' : 'Yangi yangilik'}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="news-title">Sarlavha</Label>
            <Input
              id="news-title"
              placeholder="Yangilik sarlavhasi…"
              {...register('titleUz')}
            />
            {errors.titleUz ? (
              <p className="text-xs font-medium text-destructive">{errors.titleUz.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="news-body">Xabar matni</Label>
            <textarea
              id="news-body"
              rows={8}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Yangilik matnini kiriting…"
              {...register('bodyUz')}
            />
            {errors.bodyUz ? (
              <p className="text-xs font-medium text-destructive">{errors.bodyUz.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fayl / rasm biriktirish (ixtiyoriy)</Label>
              <span className="text-xs text-muted-foreground">Maks: 20 MB</span>
            </div>

            {/* Mavjud fayl (edit rejim) */}
            {isEdit && news?.attachmentFileName && !file && !removeAttachment ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{news.attachmentFileName}</span>
                  {news.attachmentSizeBytes ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmtSize(news.attachmentSizeBytes)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveAttachment(true)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Bu faylni o'chirish"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const first = e.dataTransfer.files?.[0];
                if (first) pickFile(first);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center transition-all',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
              )}
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-foreground">
                <span className="font-medium text-primary">Bosing</span> yoki bu yerga tashlang
              </p>
              <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT, rasm</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                  e.target.value = '';
                }}
              />
            </div>

            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtSize(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {fileError ? (
              <p className="text-xs font-medium text-destructive">{fileError}</p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={watch('isPublished')}
              onCheckedChange={(v) => setValue('isPublished', !!v)}
            />
            <span className="text-sm text-foreground">
              Nashr etilgan (barcha foydalanuvchilarga bildirishnoma yuboriladi)
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
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
