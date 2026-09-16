'use client';

import {
  createLessonSchema,
  LESSON_TYPE,
  LESSON_TYPE_LABELS_UZ,
  type CreateLessonInput,
  type LessonDto,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download, FileText, Loader2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { materialsApi } from '@/features/learning/api/materials-api';
import { useCreateLesson, useUpdateLesson } from '@/features/learning/hooks/use-learning';
import { useCourseMaterials, useRemoveMaterial } from '@/features/learning/hooks/use-materials';
import {
  ACCEPT_ATTR,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  formatFileSize,
} from '@/features/learning/lib/file-upload';
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
import type { ApiError } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/cn';

interface LessonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  lesson?: LessonDto | null;
  nextOrderIndex: number;
}

export function LessonFormDialog({
  open,
  onOpenChange,
  courseId,
  lesson,
  nextOrderIndex,
}: LessonFormDialogProps) {
  const isEdit = !!lesson;
  const create = useCreateLesson();
  const update = useUpdateLesson();
  const removeMaterial = useRemoveMaterial(courseId);
  const { data: courseMaterials } = useCourseMaterials(isEdit ? courseId : undefined);
  const existingFiles = useMemo(
    () =>
      lesson
        ? (courseMaterials ?? []).filter((m) => m.lessonId === lesson.id)
        : [],
    [courseMaterials, lesson],
  );
  const pending = create.isPending || update.isPending;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateLessonInput>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      courseId,
      orderIndex: nextOrderIndex,
      lessonType: LESSON_TYPE.AMALIY,
      titleUz: '',
      objectiveUz: '',
      equipmentUz: '',
      theoryUz: '',
      procedureUz: [],
    },
  });

  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    const t = lesson?.procedureUz ?? [];
    setTasks(t);
    setNewTask('');
    setFiles([]);
    setFileError(null);
    setUploadProgress(null);
    reset({
      courseId,
      orderIndex: lesson?.orderIndex ?? nextOrderIndex,
      lessonType: lesson?.lessonType ?? LESSON_TYPE.AMALIY,
      titleUz: lesson?.titleUz ?? '',
      objectiveUz: lesson?.objectiveUz ?? '',
      equipmentUz: lesson?.equipmentUz ?? '',
      theoryUz: lesson?.theoryUz ?? '',
      procedureUz: t,
    });
  }, [open, lesson, courseId, nextOrderIndex, reset]);

  const err = (create.error ?? update.error) as ApiError | undefined;

  const addTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    const next = [...tasks, trimmed];
    setTasks(next);
    setValue('procedureUz', next);
    setNewTask('');
  };

  const removeTask = (idx: number) => {
    const next = tasks.filter((_, i) => i !== idx);
    setTasks(next);
    setValue('procedureUz', next);
  };

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
      const map = new Map(prev.map((f) => [`${f.name}::${f.size}`, f]));
      newFiles.forEach((f) => map.set(`${f.name}::${f.size}`, f));
      return Array.from(map.values());
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreateLessonInput = {
      ...values,
      procedureUz: tasks,
      objectiveUz: values.objectiveUz?.trim() || null,
      equipmentUz: values.equipmentUz?.trim() || null,
      theoryUz: values.theoryUz?.trim() || null,
    };

    async function uploadFilesTo(lessonId: string) {
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;
          setUploadProgress({ current: i + 1, total: files.length });
          await materialsApi.upload(courseId, file, lessonId);
        }
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    }

    if (isEdit && lesson) {
      update.mutate(
        { id: lesson.id, input: payload },
        {
          onSuccess: async () => {
            await uploadFilesTo(lesson.id);
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
      <DialogContent className="eco-scroll max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Darsni tahrirlash' : 'Yangi dars qo‘shish'}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Tartib # — foydalanuvchi ko'rmaydi, avtomatik keyingi qiymatga
              o'rnatiladi (nextOrderIndex prop'i). */}
          <input type="hidden" {...register('orderIndex', { valueAsNumber: true })} />

          <div className="space-y-1.5">
            <Label>Turi</Label>
            <Select
              value={watch('lessonType')}
              onValueChange={(v) => setValue('lessonType', v as CreateLessonInput['lessonType'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LESSON_TYPE).map((t) => (
                  <SelectItem key={t} value={t}>
                    {LESSON_TYPE_LABELS_UZ[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Sarlavha</Label>
            <Input id="lesson-title" placeholder="Dars nomi" {...register('titleUz')} />
            {errors.titleUz ? (
              <p className="text-xs font-medium text-destructive">{errors.titleUz.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-objective">Maqsad</Label>
            <textarea
              id="lesson-objective"
              rows={2}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              {...register('objectiveUz')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-equipment">Kerakli jihozlar</Label>
            <textarea
              id="lesson-equipment"
              rows={2}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              {...register('equipmentUz')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-theory">Nazariy qism</Label>
            <textarea
              id="lesson-theory"
              rows={6}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              {...register('theoryUz')}
            />
          </div>

          <div className="space-y-2">
            <Label>Amaliy topshiriqlar</Label>
            <div className="space-y-1.5">
              {tasks.map((task, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                  <span className="shrink-0 font-medium text-muted-foreground">{idx + 1}.</span>
                  <span className="min-w-0 flex-1 break-words">{task}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeTask(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Yangi topshiriq…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTask();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTask}>
                <Plus className="h-4 w-4" />
                Qo&apos;shish
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Darslik fayllari (ixtiyoriy)</Label>
              <span className="text-xs text-muted-foreground">
                Har biri &le; {MAX_FILE_SIZE_LABEL}
              </span>
            </div>

            {/* Tahrirlashda: allaqachon yuklangan fayllar ro'yxati. */}
            {isEdit && existingFiles.length > 0 ? (
              <ul className="space-y-1.5">
                {existingFiles.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{m.fileName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(m.sizeBytes)}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => void materialsApi.download(m.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title="Yuklab olish"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMaterial.mutate(m.id)}
                        disabled={removeMaterial.isPending}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title="O'chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
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
