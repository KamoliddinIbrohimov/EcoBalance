'use client';

import {
  createCourseSchema,
  type CourseDto,
  type CreateCourseInput,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import { useCreateCourse, useUpdateCourse } from '@/features/learning/hooks/use-learning';
import { materialsApi } from '@/features/learning/api/materials-api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { ApiError } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/cn';
import { makeSlug } from '@/shared/lib/slug';

import {
  ACCEPT_ATTR,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  formatFileSize,
} from '@/features/learning/lib/file-upload';

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: CourseDto | null;
}

export function CourseFormDialog({ open, onOpenChange, course }: CourseFormDialogProps) {
  const isEdit = !!course;
  const create = useCreateCourse();
  const update = useUpdateCourse();
  const { data: levels } = useEducationLevels();
  const pending = create.isPending || update.isPending;

  const defaultLevel = levels?.[0]?.slug ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateCourseInput>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      slug: '',
      nameUz: '',
      descriptionUz: '',
      educationLevel: defaultLevel,
      isPublished: false,
    },
  });

  const watchedName = watch('nameUz');
  const watchedSlug = watch('slug');

  useEffect(() => {
    if (!open) return;
    reset({
      slug: course?.slug ?? '',
      nameUz: course?.nameUz ?? '',
      descriptionUz: course?.descriptionUz ?? '',
      educationLevel: course?.educationLevel ?? defaultLevel,
      isPublished: course?.isPublished ?? false,
    });
    setFiles([]);
    setFileError(null);
    setUploadProgress(null);
  }, [open, course, reset, defaultLevel]);

  useEffect(() => {
    if (isEdit) return;
    setValue('slug', makeSlug(watchedName ?? ''));
  }, [watchedName, isEdit, setValue]);

  const err = (create.error ?? update.error) as ApiError | undefined;
  const noLevels = !levels || levels.length === 0;

  function addFiles(newFiles: File[]) {
    setFileError(null);
    const tooBig = newFiles.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setFileError(
        `"${tooBig.name}" — juda katta (${formatFileSize(tooBig.size)}). Maks: ${MAX_FILE_SIZE_LABEL}.`,
      );
      return;
    }
    setFiles((prev) => {
      // Dublikatni oldini olamiz (name + size juftligi)
      const map = new Map(prev.map((f) => [`${f.name}::${f.size}`, f]));
      newFiles.forEach((f) => map.set(`${f.name}::${f.size}`, f));
      return Array.from(map.values());
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreateCourseInput = {
      ...values,
      descriptionUz: values.descriptionUz?.trim() || null,
    };

    async function uploadFilesTo(courseId: string) {
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;
          setUploadProgress({ current: i + 1, total: files.length });
          await materialsApi.upload(courseId, file);
        }
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    }

    if (isEdit && course) {
      update.mutate(
        { id: course.id, input: payload },
        {
          onSuccess: async () => {
            await uploadFilesTo(course.id);
            onOpenChange(false);
          },
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: async (created) => {
          await uploadFilesTo(created.id);
          onOpenChange(false);
        },
      });
    }
  });

  const busy = pending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Kursni tahrirlash' : 'Yangi kurs qo‘shish'}</DialogTitle>
        </DialogHeader>

        {noLevels ? (
          <Alert variant="destructive">
            <AlertDescription>
              Avval kamida bitta ta&apos;lim darajasini yarating (yuqorida &laquo;Ta&apos;lim
              darajalari&raquo; bo&apos;limi &rarr; Yangi daraja).
            </AlertDescription>
          </Alert>
        ) : null}

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="course-name">Nomi</Label>
            <Input
              id="course-name"
              placeholder="Masalan: Ekologiya asoslari"
              {...register('nameUz')}
            />
            {errors.nameUz ? (
              <p className="text-xs font-medium text-destructive">{errors.nameUz.message}</p>
            ) : null}
            {!isEdit && watchedSlug ? (
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">/learning/course/{watchedSlug}</span>
              </p>
            ) : null}
            {errors.slug ? (
              <p className="text-xs font-medium text-destructive">{errors.slug.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Ta&apos;lim darajasi</Label>
            <Select
              value={watch('educationLevel')}
              onValueChange={(v) => setValue('educationLevel', v)}
              disabled={noLevels}
            >
              <SelectTrigger>
                <SelectValue placeholder="Daraja tanlang" />
              </SelectTrigger>
              <SelectContent>
                {(levels ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.slug}>
                    {l.nameUz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.educationLevel ? (
              <p className="text-xs font-medium text-destructive">
                {errors.educationLevel.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-desc">Tavsif (ixtiyoriy)</Label>
            <textarea
              id="course-desc"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="Kurs haqida qisqacha…"
              {...register('descriptionUz')}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Materiallar (ixtiyoriy)</Label>
              <span className="text-xs text-muted-foreground">
                Har biri &le; {MAX_FILE_SIZE_LABEL}
              </span>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = Array.from(e.dataTransfer.files);
                if (dropped.length > 0) addFiles(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
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
              <p className="text-xs text-muted-foreground">
                PDF, DOCX, XLSX, PPT, rasm, arxiv va boshqalar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  if (chosen.length > 0) addFiles(chosen);
                  e.target.value = '';
                }}
              />
            </div>

            {fileError ? (
              <p className="text-xs font-medium text-destructive">{fileError}</p>
            ) : null}

            {files.length > 0 ? (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {f.type.startsWith('image/') ? (
                        <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(f.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Ro'yxatdan olib tashlash"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {uploadProgress ? (
              <p className="text-xs text-muted-foreground">
                Yuklanmoqda: {uploadProgress.current} / {uploadProgress.total}…
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={watch('isPublished')}
              onCheckedChange={(v) => setValue('isPublished', !!v)}
            />
            <span className="text-sm text-foreground">Nashr etilgan (talabalarga ko‘rinadi)</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={busy || noLevels}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
