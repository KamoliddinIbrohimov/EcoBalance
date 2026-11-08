'use client';

import type { CourseDto, LessonDto } from '@eco/shared';
import { useQueries } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import Link from 'next/link';

import { learningApi } from '@/features/learning/api/learning-api';
import { materialsApi, type CourseMaterialDto } from '@/features/learning/api/materials-api';
import { useCoursesList } from '@/features/learning/hooks/use-learning';
import { formatFileSize } from '@/features/learning/lib/file-upload';
import { Card } from '@/shared/components/ui/card';

interface VideoLesson {
  course: CourseDto;
  lesson: LessonDto;
  position: number;
  video: CourseMaterialDto;
}

/**
 * Foydalanuvchiga ochiq kurslardagi barcha video darsliklar — kurs bo'yicha
 * guruhlangan kartalar, har biri dars sahifasiga olib boradi.
 */
export function VideoLessonsList({ limit }: { limit?: number }) {
  const { data: courses, isLoading } = useCoursesList({ perPage: 100 });
  const list = courses?.data ?? [];

  // Kalitlar learning/materials hook'lari bilan bir xil — kesh dars sahifasi bilan bo'linadi.
  const materials = useQueries({
    queries: list.map((c) => ({
      queryKey: ['learning', 'materials', c.id],
      queryFn: () => materialsApi.list(c.id),
    })),
  });
  const lessons = useQueries({
    queries: list.map((c) => ({
      queryKey: ['learning', 'lessons', 'course', c.id],
      queryFn: () => learningApi.courseLessons(c.id),
    })),
  });

  const loading = isLoading || materials.some((q) => q.isLoading) || lessons.some((q) => q.isLoading);

  const groups = list
    .map((course, i) => {
      const sorted = (lessons[i]?.data ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);
      const items: VideoLesson[] = (materials[i]?.data ?? [])
        .filter((m) => m.lessonId && m.mimeType.startsWith('video/'))
        .flatMap((video) => {
          const idx = sorted.findIndex((l) => l.id === video.lessonId);
          const lesson = sorted[idx];
          return lesson ? [{ course, lesson, position: idx + 1, video }] : [];
        })
        .sort((a, b) => a.position - b.position);
      return { course, items };
    })
    .filter((g) => g.items.length > 0);

  if (loading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Yuklanmoqda…</Card>;
  }
  if (groups.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Hozircha sizga ochiq video darslik yo‘q. O‘qituvchingiz kursni guruhingizga biriktirgach, shu yerda paydo bo‘ladi.
      </Card>
    );
  }

  let shown = 0;
  return (
    <div className="space-y-6">
      {groups.map(({ course, items }) => {
        const visible = limit ? items.slice(0, Math.max(0, limit - shown)) : items;
        shown += visible.length;
        if (visible.length === 0) return null;
        return (
          <section key={course.id} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{course.nameUz}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map(({ lesson, position, video }) => (
                <li key={video.id}>
                  <Link
                    href={`/learning/${course.slug}/${lesson.id}`}
                    className="group flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-primary/5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <PlayCircle className="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">{position}-dars</span>
                      <span className="mt-0.5 line-clamp-2 block text-sm font-medium text-foreground">
                        {lesson.titleUz}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Video · {formatFileSize(video.sizeBytes)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
