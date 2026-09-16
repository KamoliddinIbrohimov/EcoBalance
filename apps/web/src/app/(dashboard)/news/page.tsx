'use client';

import { PERMISSION, type NewsDto } from '@eco/shared';
import { Download, FileText, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { NewsFormDialog } from '@/features/news/components/news-form-dialog';
import { useNewsList, useRemoveNews } from '@/features/news/hooks/use-news';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import type { ApiError } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.NEWS_READ);
  const canManage = hasPermission(PERMISSION.NEWS_MANAGE);

  // Admin barcha (draft+published) ko'rsin, oddiy foydalanuvchi faqat published
  const { data, isLoading } = useNewsList(
    canManage ? { page: 1, perPage: 50 } : { page: 1, perPage: 50, isPublished: true },
  );
  const remove = useRemoveNews();
  const removeErr = remove.error as ApiError | undefined;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewsDto | null>(null);
  const [removing, setRemoving] = useState<NewsDto | null>(null);

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Newspaper className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Yangiliklar</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Platforma va ekologik faoliyatga oid rasmiy xabarlar.
            </p>
          </div>
        </div>
        {canManage ? (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Yangi yangilik
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Yuklanmoqda…</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Hozircha yangiliklar yo&apos;q.
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((n) => (
            <Card key={n.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{n.titleUz}</h2>
                    {!n.isPublished ? (
                      <Badge variant="secondary">Qoralama</Badge>
                    ) : (
                      <Badge variant="default">Nashr etilgan</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {n.authorName ? <span>Muallif: {n.authorName}</span> : null}
                    <span>
                      {n.publishedAt
                        ? new Date(n.publishedAt).toLocaleDateString('uz-UZ')
                        : new Date(n.createdAt).toLocaleDateString('uz-UZ')}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm text-foreground">{n.bodyUz}</p>
                  {n.attachmentUrl && n.attachmentFileName ? (
                    <a
                      href={n.attachmentUrl}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-primary hover:bg-muted"
                    >
                      <FileText className="h-4 w-4" />
                      <span>{n.attachmentFileName}</span>
                      {n.attachmentSizeBytes ? (
                        <span className="text-xs text-muted-foreground">
                          {fmtSize(n.attachmentSizeBytes)}
                        </span>
                      ) : null}
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(n);
                        setDialogOpen(true);
                      }}
                      title="Tahrirlash"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRemoving(n)}
                      title="O'chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage ? (
        <NewsFormDialog open={dialogOpen} onOpenChange={setDialogOpen} news={editing} />
      ) : null}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`"${removing?.titleUz ?? ''}" yangiligini o'chirasizmi?`}
        description={removeErr?.message ?? "Amal qaytarilmaydi. Fayl ham o'chiriladi."}
        confirmLabel="Ha, o'chirish"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </div>
  );
}
