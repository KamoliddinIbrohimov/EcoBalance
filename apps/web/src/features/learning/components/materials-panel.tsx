'use client';

import { PERMISSION } from '@eco/shared';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { materialsApi, type CourseMaterialDto } from '@/features/learning/api/materials-api';
import {
  useCourseMaterials,
  useRemoveMaterial,
  useUploadMaterial,
} from '@/features/learning/hooks/use-materials';
import {
  ACCEPT_ATTR,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  formatFileSize,
} from '@/features/learning/lib/file-upload';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import type { ApiError } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';

interface MaterialsPanelProps {
  courseId: string;
  /** true bo'lsa — faqat ko'rish rejimi: yuklash zonasi va o'chirish tugmasi ko'rinmaydi. */
  viewOnly?: boolean;
  /**
   * Bo'lsa — ro'yxat va yuklashlar SHU dars bilan cheklanadi. Bo'lmasa —
   * kursning barcha fayllari ko'rinadi (kurs sathidagilar + darslar fayllari).
   */
  lessonId?: string;
  /** Sarlavha matnini o'zgartirish (masalan, "Bu darsning fayllari"). */
  title?: string;
}

export function MaterialsPanel({
  courseId,
  viewOnly = false,
  lessonId,
  title,
}: MaterialsPanelProps) {
  const t = useTranslations('learning');
  const resolvedTitle = title ?? t('materialsLabel');
  const hasMaterialsManage = useAuthStore((s) => s.hasPermission(PERMISSION.MATERIALS_MANAGE));
  const canManage = hasMaterialsManage && !viewOnly;
  const { data: allData, isLoading } = useCourseMaterials(courseId);
  // Filter:
  //  • lessonId berilgan bo'lsa — faqat SHU darsning fayllari
  //  • aks holda — faqat KURS sathidagi fayllar (biror darsga biriktirilmagan)
  //    Darsga biriktirilgan fayllar shu dars sahifasida ko'rinadi, kurs
  //    sahifasida takrorlanmaydi.
  const data = (allData ?? []).filter((m) =>
    lessonId ? m.lessonId === lessonId : m.lessonId === null,
  );
  const upload = useUploadMaterial(courseId);
  const remove = useRemoveMaterial(courseId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<CourseMaterialDto | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const uploadErr = upload.error as ApiError | undefined;

  async function handleFiles(chosen: File[]) {
    setFileError(null);
    const tooBig = chosen.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setFileError(
        `"${tooBig.name}" — juda katta (${formatFileSize(tooBig.size)}). Maks: ${MAX_FILE_SIZE_LABEL}.`,
      );
      return;
    }
    for (let i = 0; i < chosen.length; i++) {
      const file = chosen[i];
      if (!file) continue;
      setUploadProgress({ current: i + 1, total: chosen.length });
      try {
        await upload.mutateAsync({ file, lessonId });
      } catch {
        // API'dan kelgan xato mutation error orqali ko'rsatiladi; keyingi
        // fayllarni yuklashda davom etamiz.
      }
    }
    setUploadProgress(null);
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{resolvedTitle}</h3>
          {canManage ? (
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, XLSX, PPT, rasm, arxiv va boshqalar · Har biri ≤ {MAX_FILE_SIZE_LABEL}
            </p>
          ) : null}
        </div>
      </div>

      {canManage ? (
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
            if (dropped.length > 0) void handleFiles(dropped);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-5 text-center transition-all',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
            upload.isPending && 'pointer-events-none opacity-60',
          )}
        >
          {upload.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-sm text-foreground">
            <span className="font-medium text-primary">Bosing</span> yoki bu yerga fayllarni tashlang
          </p>
          {uploadProgress ? (
            <p className="text-xs text-muted-foreground">
              Yuklanmoqda: {uploadProgress.current} / {uploadProgress.total}…
            </p>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []);
              if (chosen.length > 0) void handleFiles(chosen);
              e.target.value = '';
            }}
          />
        </div>
      ) : null}

      {fileError ? (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      ) : null}

      {uploadErr ? (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{uploadErr.message}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">{t('loading')}</div>
      ) : !data || data.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {t('noMaterialsYet')}
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {data.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{m.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(m.sizeBytes)} · {new Date(m.createdAt).toLocaleDateString('uz-UZ')}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Yuklab olish"
                  onClick={() => void materialsApi.download(m.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="O'chirish"
                    onClick={() => setRemoving(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`"${removing?.fileName ?? ''}" faylini o'chirasizmi?`}
        description="Bu amalni ortga qaytarib bo'lmaydi."
        confirmLabel="Ha, o'chirish"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </Card>
  );
}
