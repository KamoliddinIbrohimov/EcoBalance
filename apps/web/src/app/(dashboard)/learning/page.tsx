'use client';

import { PERMISSION } from '@eco/shared';
import { GraduationCap, Settings } from 'lucide-react';
import Link from 'next/link';

import { CourseCard } from '@/features/learning/components/course-card';
import { useCoursesList } from '@/features/learning/hooks/use-learning';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function LearningPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.COURSES_READ);
  const canManage =
    hasPermission(PERMISSION.COURSES_CREATE) || hasPermission(PERMISSION.LESSONS_MANAGE);

  const { data, isLoading } = useCoursesList({ page: 1, perPage: 50, isPublished: canManage ? undefined : true });

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ta&apos;lim</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ekologiya bo&apos;yicha amaliy va laboratoriya mashg&apos;ulotlari.
            </p>
          </div>
        </div>
        {canManage ? (
          <Button asChild variant="outline">
            <Link href="/learning/manage">
              <Settings className="h-4 w-4" />
              Boshqarish
            </Link>
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Yuklanmoqda…</Card>
      ) : !data || data.data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Hozircha kurslar yo&apos;q.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.data.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
