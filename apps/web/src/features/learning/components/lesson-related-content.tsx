'use client';

import type { AssignmentDto, QuizSummaryDto } from '@eco/shared';
import { ClipboardList, GraduationCap, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { apiClient } from '@/shared/lib/api-client';
import { formatDateTime } from '@/shared/lib/format-date';

interface Envelope<T> {
  data: T;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number };
}

/**
 * U5: dars sahifasida shu dars yoki modulga biriktirilgan topshiriqlar va testlar
 * ro'yxati. Talaba darsni ochganda avtomatik yuklanadi.
 */
export function LessonRelatedContent({
  lessonId,
  moduleId,
}: {
  lessonId: string;
  moduleId: string | null;
}) {
  const { data: assignments } = useQuery({
    queryKey: ['assignments', 'by-lesson', lessonId],
    queryFn: async () => {
      const r = await apiClient.get<Paginated<AssignmentDto>>('/assignments', {
        params: { lessonId },
      });
      return r.data.data;
    },
  });

  const { data: assignmentsByModule } = useQuery({
    queryKey: ['assignments', 'by-module', moduleId],
    queryFn: async () => {
      const r = await apiClient.get<Paginated<AssignmentDto>>('/assignments', {
        params: { moduleId },
      });
      return r.data.data;
    },
    enabled: !!moduleId,
  });

  const { data: quizzes } = useQuery({
    queryKey: ['quizzes', 'by-lesson', lessonId],
    queryFn: async () => {
      const r = await apiClient.get<Envelope<QuizSummaryDto[]>>(`/my-quizzes/by-lesson/${lessonId}`);
      return r.data.data;
    },
  });

  const allAssignments = [
    ...(assignments ?? []),
    ...(assignmentsByModule ?? []).filter((a) => a.lessonId !== lessonId),
  ];

  if (!assignments && !quizzes) {
    return (
      <Card className="p-5 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
      </Card>
    );
  }

  if (allAssignments.length === 0 && (!quizzes || quizzes.length === 0)) return null;

  return (
    <div className="space-y-4">
      {allAssignments.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <ClipboardList className="h-4 w-4" />
            Shu mavzu bo&apos;yicha topshiriqlar
          </h2>
          <ul className="space-y-2">
            {allAssignments.map((a) => (
              <li key={a.id}>
                <Link
                  href="/assignments"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3 hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{a.titleUz}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline">{a.kind}</Badge>
                      {a.dueAt ? (
                        <Badge variant="outline">
                          Muddat: {formatDateTime(new Date(a.dueAt))}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary">Maks: {a.maxScore}</Badge>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {quizzes && quizzes.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <GraduationCap className="h-4 w-4" />
            Shu dars testlari
          </h2>
          <ul className="space-y-2">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/monitoring/tests?quizId=${q.id}`}
                  className="block rounded-lg border border-border/60 p-3 hover:border-primary/40"
                >
                  <div className="truncate font-medium text-foreground">{q.titleUz}</div>
                  {q.descriptionUz ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {q.descriptionUz}
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
