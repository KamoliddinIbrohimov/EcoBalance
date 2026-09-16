'use client';

import { PERMISSION } from '@eco/shared';
import { GraduationCap, Search, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CourseCard } from '@/features/learning/components/course-card';
import { useCoursesList } from '@/features/learning/hooks/use-learning';
import { useEducationLevels } from '@/features/learning/hooks/use-education-levels';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { UnderDevelopment } from '@/shared/components/layout/under-development';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function LearningLevelPage() {
  const params = useParams<{ slug: string }>();
  const t = useTranslations('learning');
  const { data: levels, isLoading: levelsLoading } = useEducationLevels();

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.COURSES_READ);
  const canManage =
    hasPermission(PERMISSION.COURSES_CREATE) || hasPermission(PERMISSION.LESSONS_MANAGE);

  const level = (levels ?? []).find((l) => l.slug === params.slug);

  const { data: coursesData, isLoading: coursesLoading } = useCoursesList({
    page: 1,
    perPage: 50,
    educationLevel: level?.slug,
    isPublished: canManage ? undefined : true,
  });

  const [searchQuery, setSearchQuery] = useState('');

  const allCourses = useMemo(() => coursesData?.data ?? [], [coursesData]);
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter((c) => {
      const name = c.nameUz?.toLowerCase() ?? '';
      const desc = c.descriptionUz?.toLowerCase() ?? '';
      return name.includes(q) || desc.includes(q);
    });
  }, [allCourses, searchQuery]);

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  if (!levelsLoading && !level) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {level?.nameUz ?? t('loading')}
            </h1>
            {level?.descriptionUz ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{level.descriptionUz}</p>
            ) : null}
          </div>
        </div>
        {canManage ? (
          <Button asChild variant="outline">
            <Link href="/learning/manage">
              <Settings className="h-4 w-4" />
              {t('manage')}
            </Link>
          </Button>
        ) : null}
      </div>

      {allCourses.length > 0 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}

      {coursesLoading || levelsLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t('loading')}</Card>
      ) : allCourses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('noCoursesForLevel')}
        </Card>
      ) : filteredCourses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('noSearchMatches')}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
