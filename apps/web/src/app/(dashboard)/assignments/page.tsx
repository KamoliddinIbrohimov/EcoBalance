'use client';

import type { AssignmentDto } from '@eco/shared';
import { ClipboardList, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { apiClient } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/stores/auth-store';

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

const DATE_FMT = new Intl.DateTimeFormat('uz-UZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function AssignmentsPage() {
  const user = useAuthStore((s) => s.user);
  const isTeacherOrSA = user?.roles?.some((r) => r === 'SUPER_ADMIN' || r === 'TEACHER');

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<Paginated<AssignmentDto>>('/assignments', {
        params: { page: 1, perPage: 50 },
      });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Topshiriqlar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isTeacherOrSA
              ? "O'qituvchi — o'z guruhlariga topshiriq yaratish va baholash."
              : 'Siz uchun berilgan topshiriqlar ro\'yxati.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Hozircha topshiriqlar yo&apos;q.
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((a) => (
            <li key={a.id}>
              <Card className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-foreground">{a.titleUz}</h2>
                  {a.descriptionUz ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {a.descriptionUz}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {a.dueAt ? (
                      <Badge variant="outline">Muddat: {DATE_FMT.format(new Date(a.dueAt))}</Badge>
                    ) : (
                      <Badge variant="outline">Muddat belgilanmagan</Badge>
                    )}
                    <Badge variant="secondary">Maks ball: {a.maxScore}</Badge>
                    {isTeacherOrSA ? (
                      <Badge variant="secondary">{a.submissionCount} topshirgan</Badge>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
